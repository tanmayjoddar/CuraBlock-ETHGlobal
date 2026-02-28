package services

import (
	"Wallet/backend/models"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ═══════════════════════════════════════════════════════════════════════
// EventListenerService — On-chain event listener for QuadraticVoting
//
// Connects via WebSocket to Monad testnet, subscribes to ProposalExecuted
// events, and writes confirmed scam data to PostgreSQL ConfirmedScam table.
// This is the critical bridge between on-chain DAO governance and the
// off-chain ML flywheel: community votes → confirmed scams → better AI.
// ═══════════════════════════════════════════════════════════════════════

// Minimal ABI covering only the events and view functions we need.
// Kept inline to avoid an external JSON dependency.
const quadraticVotingABI = `[
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true,  "name": "proposalId", "type": "uint256"},
      {"indexed": false, "name": "passed",     "type": "bool"}
    ],
    "name": "ProposalExecuted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true,  "name": "scamAddress", "type": "address"},
      {"indexed": false, "name": "score",       "type": "uint256"}
    ],
    "name": "ScamAddressConfirmed",
    "type": "event"
  },
  {
    "inputs": [{"name": "proposalId", "type": "uint256"}],
    "name": "getProposal",
    "outputs": [
      {"name": "reporter",           "type": "address"},
      {"name": "suspiciousAddress",  "type": "address"},
      {"name": "description",        "type": "string"},
      {"name": "evidence",           "type": "string"},
      {"name": "votesFor",           "type": "uint256"},
      {"name": "votesAgainst",       "type": "uint256"},
      {"name": "_isActive",          "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "proposalId", "type": "uint256"}],
    "name": "getProposalVoterCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "", "type": "address"}],
    "name": "scamScore",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
]`

// Pre-computed event topic hashes (keccak256 of event signatures).
var (
	proposalExecutedTopic    = crypto.Keccak256Hash([]byte("ProposalExecuted(uint256,bool)"))
	scamAddressConfirmedTopic = crypto.Keccak256Hash([]byte("ScamAddressConfirmed(address,uint256)"))
)

// EventListenerService subscribes to on-chain QuadraticVoting events
// and syncs confirmed scams into PostgreSQL.
type EventListenerService struct {
	db              *gorm.DB
	contractAddr    common.Address
	wsURL           string
	httpURL         string // Fallback HTTP RPC for view calls and polling
	parsedABI       abi.ABI
	stopCh          chan struct{}
	wg              sync.WaitGroup
	lastPolledBlock uint64 // Track last polled block for HTTP fallback
}

// NewEventListenerService creates a new event listener.
// wsURL: WebSocket RPC endpoint (wss://...)
// httpURL: HTTP RPC endpoint for view function calls
// contractAddr: deployed QuadraticVoting address
func NewEventListenerService(db *gorm.DB) (*EventListenerService, error) {
	wsURL := os.Getenv("MONAD_WS_URL")
	if wsURL == "" {
		wsURL = "wss://ethereum-sepolia-rpc.publicnode.com"
	}

	httpURL := os.Getenv("MONAD_RPC_URL")
	if httpURL == "" {
		httpURL = "https://ethereum-sepolia-rpc.publicnode.com"
	}

	contractAddrStr := os.Getenv("QUADRATIC_VOTING_ADDRESS")
	if contractAddrStr == "" {
		contractAddrStr = "0x810DA31a1eFB767652b2f969972d2A612AfdEc5C"
	}

	parsed, err := abi.JSON(strings.NewReader(quadraticVotingABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse QuadraticVoting ABI: %w", err)
	}

	// Auto-migrate ConfirmedScam to pick up new columns (TxHash, BlockNumber)
	if err := db.AutoMigrate(&models.ConfirmedScam{}); err != nil {
		log.Printf("[event-listener] WARNING: auto-migrate ConfirmedScam failed: %v", err)
	}

	return &EventListenerService{
		db:           db,
		contractAddr: common.HexToAddress(contractAddrStr),
		wsURL:        wsURL,
		httpURL:      httpURL,
		parsedABI:    parsed,
		stopCh:       make(chan struct{}),
	}, nil
}

// Start launches the event listener goroutine. Non-blocking.
func (s *EventListenerService) Start() {
	// Sync any historical events we may have missed while offline
	go s.syncHistoricalEvents()

	s.wg.Add(1)
	go s.listenLoop()
	logJSON("info", "event listener started", map[string]interface{}{
		"contract": s.contractAddr.Hex(),
		"wsURL":    s.wsURL,
	})
}

// Stop gracefully shuts down the listener.
func (s *EventListenerService) Stop() {
	close(s.stopCh)
	s.wg.Wait()
	logJSON("info", "event listener stopped", nil)
}

// ═══════════════════════════════════════════════════════════════════════
// STARTUP SYNC — catch up on missed events from past blocks
// ═══════════════════════════════════════════════════════════════════════

func (s *EventListenerService) syncHistoricalEvents() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client, err := ethclient.DialContext(ctx, s.httpURL)
	if err != nil {
		logJSON("error", "historical sync: RPC dial failed", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}
	defer client.Close()

	latestBlock, err := client.BlockNumber(ctx)
	if err != nil {
		logJSON("error", "historical sync: failed to get block number", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	// Scan back ~50000 blocks (~7 days on Sepolia at 12s/block)
	fromBlock := uint64(0)
	if latestBlock > 50000 {
		fromBlock = latestBlock - 50000
	}

	logJSON("info", "historical sync: scanning for missed events", map[string]interface{}{
		"fromBlock": fromBlock,
		"toBlock":   latestBlock,
		"contract":  s.contractAddr.Hex(),
	})

	query := ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(latestBlock),
		Addresses: []common.Address{s.contractAddr},
		Topics:    [][]common.Hash{{proposalExecutedTopic}},
	}

	logs, err := client.FilterLogs(ctx, query)
	if err != nil {
		logJSON("error", "historical sync: FilterLogs failed", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	if len(logs) == 0 {
		logJSON("info", "historical sync: no missed events found", nil)
		return
	}

	logJSON("info", "historical sync: processing missed events", map[string]interface{}{
		"count": len(logs),
	})

	for _, vLog := range logs {
		s.handleProposalExecuted(client, vLog)
	}

	logJSON("info", "historical sync: complete", map[string]interface{}{
		"processed": len(logs),
	})
}

// ═══════════════════════════════════════════════════════════════════════
// CORE LOOP — subscribe, process, reconnect
// ═══════════════════════════════════════════════════════════════════════

func (s *EventListenerService) listenLoop() {
	defer s.wg.Done()

	// Try WebSocket subscription first
	logJSON("info", "attempting WebSocket subscription...", nil)
	err := s.subscribe()
	if err != nil {
		logJSON("warn", "WebSocket subscription failed, falling back to HTTP polling", map[string]interface{}{
			"error": err.Error(),
		})
	} else {
		return // WS subscription ran until stopped
	}

	// ── HTTP POLLING FALLBACK ──
	// Most public Sepolia RPC nodes don't support eth_subscribe.
	// Poll every 15 seconds for new ProposalExecuted events.
	pollInterval := 15 * time.Second
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	logJSON("info", "HTTP polling fallback started", map[string]interface{}{
		"interval": pollInterval.String(),
		"contract": s.contractAddr.Hex(),
		"rpcURL":   s.httpURL,
	})

	// Do an initial poll immediately
	s.pollForEvents()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.pollForEvents()
		}
	}
}

// subscribe connects via WS and blocks until the subscription ends or errors.
func (s *EventListenerService) subscribe() error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	client, err := ethclient.DialContext(ctx, s.wsURL)
	if err != nil {
		return fmt.Errorf("WS dial failed: %w", err)
	}
	defer client.Close()

	logJSON("info", "connected to Monad WebSocket", map[string]interface{}{
		"url": s.wsURL,
	})

	// Build log filter: only our contract, only ProposalExecuted topic
	query := ethereum.FilterQuery{
		Addresses: []common.Address{s.contractAddr},
		Topics:    [][]common.Hash{{proposalExecutedTopic}},
	}

	logCh := make(chan types.Log, 64)
	sub, err := client.SubscribeFilterLogs(context.Background(), query, logCh)
	if err != nil {
		return fmt.Errorf("SubscribeFilterLogs failed: %w", err)
	}
	defer sub.Unsubscribe()

	logJSON("info", "subscribed to ProposalExecuted events", map[string]interface{}{
		"contract": s.contractAddr.Hex(),
		"topic":    proposalExecutedTopic.Hex(),
	})

	// Reset backoff on successful subscription
	// (handled by caller via the error return)

	for {
		select {
		case <-s.stopCh:
			return nil

		case err := <-sub.Err():
			return fmt.Errorf("subscription error: %w", err)

		case vLog := <-logCh:
			s.handleProposalExecuted(client, vLog)
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════
// HTTP POLLING FALLBACK — for RPC nodes that don't support eth_subscribe
// ═══════════════════════════════════════════════════════════════════════

func (s *EventListenerService) pollForEvents() {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	client, err := ethclient.DialContext(ctx, s.httpURL)
	if err != nil {
		logJSON("error", "HTTP poll: RPC dial failed", map[string]interface{}{
			"error": err.Error(),
			"url":   s.httpURL,
		})
		return
	}
	defer client.Close()

	// Get current block number
	latestBlock, err := client.BlockNumber(ctx)
	if err != nil {
		logJSON("error", "HTTP poll: failed to get block number", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	// On first poll, look back ~200 blocks (~40 min on Sepolia)
	if s.lastPolledBlock == 0 {
		if latestBlock > 200 {
			s.lastPolledBlock = latestBlock - 200
		}
	}

	// Nothing new yet
	if latestBlock <= s.lastPolledBlock {
		return
	}

	// Query for ProposalExecuted events in the new block range
	query := ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(s.lastPolledBlock + 1),
		ToBlock:   new(big.Int).SetUint64(latestBlock),
		Addresses: []common.Address{s.contractAddr},
		Topics:    [][]common.Hash{{proposalExecutedTopic}},
	}

	logs, err := client.FilterLogs(ctx, query)
	if err != nil {
		logJSON("error", "HTTP poll: FilterLogs failed", map[string]interface{}{
			"error":     err.Error(),
			"fromBlock": s.lastPolledBlock + 1,
			"toBlock":   latestBlock,
		})
		return
	}

	// Update last polled block
	s.lastPolledBlock = latestBlock

	if len(logs) == 0 {
		return // No new events — this is the common case
	}

	logJSON("info", "HTTP poll: found ProposalExecuted events", map[string]interface{}{
		"count":     len(logs),
		"fromBlock": query.FromBlock.Uint64(),
		"toBlock":   latestBlock,
	})

	for _, vLog := range logs {
		s.handleProposalExecuted(client, vLog)
	}
}

// ═══════════════════════════════════════════════════════════════════════
// EVENT HANDLER — parse event, fetch proposal, write to DB
// ═══════════════════════════════════════════════════════════════════════

func (s *EventListenerService) handleProposalExecuted(client *ethclient.Client, vLog types.Log) {
	// Parse the ProposalExecuted event
	// Topic[0] = event sig, Topic[1] = indexed proposalId (uint256)
	if len(vLog.Topics) < 2 {
		logJSON("warn", "ProposalExecuted log with insufficient topics", map[string]interface{}{
			"txHash": vLog.TxHash.Hex(),
			"topics": len(vLog.Topics),
		})
		return
	}

	proposalID := new(big.Int).SetBytes(vLog.Topics[1].Bytes())

	// Decode non-indexed data: (bool passed)
	eventData := map[string]interface{}{}
	if err := s.parsedABI.UnpackIntoMap(eventData, "ProposalExecuted", vLog.Data); err != nil {
		logJSON("error", "failed to unpack ProposalExecuted data", map[string]interface{}{
			"error":      err.Error(),
			"txHash":     vLog.TxHash.Hex(),
			"proposalId": proposalID.String(),
		})
		return
	}

	passed, ok := eventData["passed"].(bool)
	if !ok {
		logJSON("error", "ProposalExecuted 'passed' field not a bool", map[string]interface{}{
			"txHash":     vLog.TxHash.Hex(),
			"proposalId": proposalID.String(),
		})
		return
	}

	logJSON("info", "ProposalExecuted event received", map[string]interface{}{
		"proposalId":  proposalID.String(),
		"passed":      passed,
		"txHash":      vLog.TxHash.Hex(),
		"blockNumber": vLog.BlockNumber,
	})

	if !passed {
		// Proposal rejected — nothing to write to ConfirmedScam
		logJSON("info", "proposal rejected, no scam confirmation needed", map[string]interface{}{
			"proposalId": proposalID.String(),
		})
		return
	}

	// ── Proposal passed → fetch on-chain data to write to DB ──

	// Use the HTTP RPC for view calls (more reliable than WS for eth_call)
	httpClient, err := ethclient.Dial(s.httpURL)
	if err != nil {
		logJSON("error", "HTTP RPC dial failed for view call", map[string]interface{}{
			"error": err.Error(),
			"url":   s.httpURL,
		})
		// Fall back to the existing WS client
		httpClient = client
	} else {
		defer httpClient.Close()
	}

	// Call getProposal(proposalId) to get address, description, votes
	proposal, err := s.callGetProposal(httpClient, proposalID)
	if err != nil {
		logJSON("error", "getProposal call failed", map[string]interface{}{
			"error":      err.Error(),
			"proposalId": proposalID.String(),
		})
		return
	}

	// Call getProposalVoterCount(proposalId)
	voterCount, err := s.callGetVoterCount(httpClient, proposalID)
	if err != nil {
		logJSON("warn", "getProposalVoterCount call failed, defaulting to 0", map[string]interface{}{
			"error":      err.Error(),
			"proposalId": proposalID.String(),
		})
		voterCount = 0
	}

	// Call scamScore(suspiciousAddress) for the latest on-chain score
	scamScoreVal, err := s.callScamScore(httpClient, proposal.SuspiciousAddress)
	if err != nil {
		logJSON("warn", "scamScore call failed, using 100 as default", map[string]interface{}{
			"error":   err.Error(),
			"address": proposal.SuspiciousAddress.Hex(),
		})
		scamScoreVal = 100
	}

	// ── Write to PostgreSQL ConfirmedScam table ──
	record := models.ConfirmedScam{
		Address:     strings.ToLower(proposal.SuspiciousAddress.Hex()),
		ScamScore:   int(scamScoreVal),
		ProposalID:  uint(proposalID.Uint64()),
		ConfirmedAt: time.Now().UTC(),
		TotalVoters: int(voterCount),
		Description: proposal.Description,
		TxHash:      vLog.TxHash.Hex(),
		BlockNumber: vLog.BlockNumber,
	}

	// Upsert: if the address already exists, update score + metadata
	result := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "address"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"scam_score", "proposal_id", "confirmed_at",
			"total_voters", "description", "tx_hash", "block_number",
		}),
	}).Create(&record)

	if result.Error != nil {
		logJSON("error", "failed to write ConfirmedScam record", map[string]interface{}{
			"error":   result.Error.Error(),
			"address": record.Address,
			"txHash":  record.TxHash,
		})
		return
	}

	logJSON("info", "✅ scam address confirmed and synced to DB", map[string]interface{}{
		"address":     record.Address,
		"scamScore":   record.ScamScore,
		"proposalId":  record.ProposalID,
		"totalVoters": record.TotalVoters,
		"txHash":      record.TxHash,
		"blockNumber": record.BlockNumber,
	})
}

// ═══════════════════════════════════════════════════════════════════════
// ON-CHAIN VIEW CALL HELPERS
// ═══════════════════════════════════════════════════════════════════════

// proposalResult holds the decoded getProposal() return values.
type proposalResult struct {
	Reporter          common.Address
	SuspiciousAddress common.Address
	Description       string
	Evidence          string
	VotesFor          *big.Int
	VotesAgainst      *big.Int
	IsActive          bool
}

func (s *EventListenerService) callGetProposal(client *ethclient.Client, proposalID *big.Int) (*proposalResult, error) {
	callData, err := s.parsedABI.Pack("getProposal", proposalID)
	if err != nil {
		return nil, fmt.Errorf("ABI pack getProposal: %w", err)
	}

	msg := ethereum.CallMsg{
		To:   &s.contractAddr,
		Data: callData,
	}

	output, err := client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return nil, fmt.Errorf("eth_call getProposal: %w", err)
	}

	results, err := s.parsedABI.Unpack("getProposal", output)
	if err != nil {
		return nil, fmt.Errorf("ABI unpack getProposal: %w", err)
	}

	if len(results) < 7 {
		return nil, fmt.Errorf("getProposal returned %d values, expected 7", len(results))
	}

	return &proposalResult{
		Reporter:          results[0].(common.Address),
		SuspiciousAddress: results[1].(common.Address),
		Description:       results[2].(string),
		Evidence:          results[3].(string),
		VotesFor:          results[4].(*big.Int),
		VotesAgainst:      results[5].(*big.Int),
		IsActive:          results[6].(bool),
	}, nil
}

func (s *EventListenerService) callGetVoterCount(client *ethclient.Client, proposalID *big.Int) (uint64, error) {
	callData, err := s.parsedABI.Pack("getProposalVoterCount", proposalID)
	if err != nil {
		return 0, fmt.Errorf("ABI pack getProposalVoterCount: %w", err)
	}

	msg := ethereum.CallMsg{
		To:   &s.contractAddr,
		Data: callData,
	}

	output, err := client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return 0, fmt.Errorf("eth_call getProposalVoterCount: %w", err)
	}

	results, err := s.parsedABI.Unpack("getProposalVoterCount", output)
	if err != nil {
		return 0, fmt.Errorf("ABI unpack getProposalVoterCount: %w", err)
	}

	if len(results) < 1 {
		return 0, fmt.Errorf("getProposalVoterCount returned no values")
	}

	count := results[0].(*big.Int)
	return count.Uint64(), nil
}

func (s *EventListenerService) callScamScore(client *ethclient.Client, addr common.Address) (uint64, error) {
	callData, err := s.parsedABI.Pack("scamScore", addr)
	if err != nil {
		return 0, fmt.Errorf("ABI pack scamScore: %w", err)
	}

	msg := ethereum.CallMsg{
		To:   &s.contractAddr,
		Data: callData,
	}

	output, err := client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return 0, fmt.Errorf("eth_call scamScore: %w", err)
	}

	results, err := s.parsedABI.Unpack("scamScore", output)
	if err != nil {
		return 0, fmt.Errorf("ABI unpack scamScore: %w", err)
	}

	if len(results) < 1 {
		return 0, fmt.Errorf("scamScore returned no values")
	}

	score := results[0].(*big.Int)
	return score.Uint64(), nil
}

// ═══════════════════════════════════════════════════════════════════════
// STRUCTURED JSON LOGGING
// ═══════════════════════════════════════════════════════════════════════

type structuredLog struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Service   string                 `json:"service"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

func logJSON(level, message string, fields map[string]interface{}) {
	entry := structuredLog{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Level:     level,
		Service:   "event-listener",
		Message:   message,
		Fields:    fields,
	}

	data, err := json.Marshal(entry)
	if err != nil {
		log.Printf("[event-listener] %s: %s (json marshal failed: %v)", level, message, err)
		return
	}

	log.Println(string(data))
}
