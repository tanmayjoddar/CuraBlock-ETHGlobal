package services

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ═══════════════════════════════════════════════════════════════════════
// OracleService — NeuroShield Threat Oracle
//
// Reads threat intelligence from the on-chain QuadraticVoting contract.
// All calls are read-only (no gas required). Any EVM protocol can use
// the same contract view functions directly, or query this service via
// the REST API.
// ═══════════════════════════════════════════════════════════════════════

// Minimal ABI for the three Threat Oracle view functions + isScammer.
const oracleABI = `[
  {
    "inputs": [{"name": "wallet", "type": "address"}],
    "name": "getThreatScore",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "wallet", "type": "address"}],
    "name": "isConfirmedScam",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "wallet", "type": "address"}],
    "name": "getDAOConfidence",
    "outputs": [
      {"name": "votesFor",           "type": "uint256"},
      {"name": "votesAgainst",       "type": "uint256"},
      {"name": "totalVoters",        "type": "uint256"},
      {"name": "confidencePercent",  "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
]`

// DAOConfidence holds the voting data returned by getDAOConfidence.
type DAOConfidence struct {
	VotesFor          uint64 `json:"votesFor"`
	VotesAgainst      uint64 `json:"votesAgainst"`
	TotalVoters       uint64 `json:"totalVoters"`
	ConfidencePercent uint64 `json:"confidencePercent"`
}

// OracleReport is the complete threat oracle response.
type OracleReport struct {
	Address           string   `json:"address"`
	Score             uint64   `json:"score"`
	RiskLabel         string   `json:"riskLabel"`
	RiskColor         string   `json:"riskColor"`
	IsConfirmedScam   bool     `json:"isConfirmedScam"`
	VotesFor          uint64   `json:"votesFor"`
	VotesAgainst      uint64   `json:"votesAgainst"`
	TotalVoters       uint64   `json:"totalVoters"`
	ConfidencePercent uint64   `json:"confidencePercent"`
	Explanation       []string `json:"explanation"`
}

// OracleService reads threat data from the QuadraticVoting contract.
type OracleService struct {
	client       *ethclient.Client
	contractAddr common.Address
	parsedABI    abi.ABI
}

// NewOracleService creates a new oracle service connected to Sepolia testnet.
func NewOracleService() (*OracleService, error) {
	rpcURL := os.Getenv("MONAD_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://ethereum-sepolia-rpc.publicnode.com"
	}

	contractAddr := os.Getenv("QUADRATIC_VOTING_ADDRESS")
	if contractAddr == "" {
		contractAddr = "0x4d2fCA51bc7D29a0559FcB05BE23C39344C84456"
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("oracle: failed to connect to RPC %s: %w", rpcURL, err)
	}

	parsed, err := abi.JSON(strings.NewReader(oracleABI))
	if err != nil {
		return nil, fmt.Errorf("oracle: failed to parse ABI: %w", err)
	}

	return &OracleService{
		client:       client,
		contractAddr: common.HexToAddress(contractAddr),
		parsedABI:    parsed,
	}, nil
}

// callContract packs input, makes an eth_call, and returns raw output bytes.
func (s *OracleService) callContract(method string, args ...interface{}) ([]byte, error) {
	input, err := s.parsedABI.Pack(method, args...)
	if err != nil {
		return nil, fmt.Errorf("oracle: pack %s: %w", method, err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	msg := ethereum.CallMsg{
		To:   &s.contractAddr,
		Data: input,
	}

	output, err := s.client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("oracle: call %s: %w", method, err)
	}
	return output, nil
}

// GetThreatScore calls getThreatScore(address) → uint256 (0-100).
func (s *OracleService) GetThreatScore(address string) (uint64, error) {
	wallet := common.HexToAddress(address)

	output, err := s.callContract("getThreatScore", wallet)
	if err != nil {
		return 0, err
	}

	results, err := s.parsedABI.Unpack("getThreatScore", output)
	if err != nil {
		return 0, fmt.Errorf("oracle: unpack getThreatScore: %w", err)
	}

	score := results[0].(*big.Int)
	return score.Uint64(), nil
}

// IsConfirmedScam calls isConfirmedScam(address) → bool.
func (s *OracleService) IsConfirmedScam(address string) (bool, error) {
	wallet := common.HexToAddress(address)

	output, err := s.callContract("isConfirmedScam", wallet)
	if err != nil {
		return false, err
	}

	results, err := s.parsedABI.Unpack("isConfirmedScam", output)
	if err != nil {
		return false, fmt.Errorf("oracle: unpack isConfirmedScam: %w", err)
	}

	return results[0].(bool), nil
}

// GetDAOConfidence calls getDAOConfidence(address) → (uint256, uint256, uint256, uint256).
func (s *OracleService) GetDAOConfidence(address string) (*DAOConfidence, error) {
	wallet := common.HexToAddress(address)

	output, err := s.callContract("getDAOConfidence", wallet)
	if err != nil {
		return nil, err
	}

	results, err := s.parsedABI.Unpack("getDAOConfidence", output)
	if err != nil {
		return nil, fmt.Errorf("oracle: unpack getDAOConfidence: %w", err)
	}

	return &DAOConfidence{
		VotesFor:          results[0].(*big.Int).Uint64(),
		VotesAgainst:      results[1].(*big.Int).Uint64(),
		TotalVoters:       results[2].(*big.Int).Uint64(),
		ConfidencePercent: results[3].(*big.Int).Uint64(),
	}, nil
}

// RiskLabelFor returns the human-readable risk category for a threat score.
func RiskLabelFor(score uint64) string {
	switch {
	case score >= 75:
		return "CRITICAL"
	case score >= 50:
		return "HIGH RISK"
	case score >= 20:
		return "UNDER REVIEW"
	default:
		return "CLEAN"
	}
}

// RiskColorFor returns the hex colour code for a threat score.
func RiskColorFor(score uint64) string {
	switch {
	case score >= 75:
		return "#DC2626" // red
	case score >= 50:
		return "#D97706" // amber
	case score >= 20:
		return "#2563EB" // blue
	default:
		return "#059669" // green
	}
}

// buildExplanation creates a human-readable summary of the oracle result.
func buildExplanation(report *OracleReport) []string {
	var lines []string

	if report.IsConfirmedScam {
		lines = append(lines, "DAO community confirmed this address as scammer")
	}

	if report.TotalVoters > 0 {
		lines = append(lines, fmt.Sprintf(
			"%d voters reached %d%% consensus",
			report.TotalVoters, report.ConfidencePercent,
		))
	}

	switch {
	case report.Score >= 75:
		lines = append(lines, "Threat level CRITICAL — avoid all interaction")
	case report.Score >= 50:
		lines = append(lines, "Threat level HIGH — exercise extreme caution")
	case report.Score >= 20:
		lines = append(lines, "Address is currently under community review")
	default:
		lines = append(lines, "No threats detected by the DAO oracle")
	}

	lines = append(lines, "Permanently recorded on Sepolia testnet")
	return lines
}

// GetFullOracleReport calls all three oracle functions in parallel and
// returns a combined report with risk labels and explanation text.
func (s *OracleService) GetFullOracleReport(address string) (*OracleReport, error) {
	var (
		score      uint64
		confirmed  bool
		confidence *DAOConfidence
		errScore   error
		errScam    error
		errConf    error
		wg         sync.WaitGroup
	)

	wg.Add(3)

	go func() {
		defer wg.Done()
		score, errScore = s.GetThreatScore(address)
	}()

	go func() {
		defer wg.Done()
		confirmed, errScam = s.IsConfirmedScam(address)
	}()

	go func() {
		defer wg.Done()
		confidence, errConf = s.GetDAOConfidence(address)
	}()

	wg.Wait()

	// Return first error encountered
	if errScore != nil {
		return nil, errScore
	}
	if errScam != nil {
		return nil, errScam
	}
	if errConf != nil {
		return nil, errConf
	}

	report := &OracleReport{
		Address:           address,
		Score:             score,
		RiskLabel:         RiskLabelFor(score),
		RiskColor:         RiskColorFor(score),
		IsConfirmedScam:   confirmed,
		VotesFor:          confidence.VotesFor,
		VotesAgainst:      confidence.VotesAgainst,
		TotalVoters:       confidence.TotalVoters,
		ConfidencePercent: confidence.ConfidencePercent,
	}

	report.Explanation = buildExplanation(report)
	return report, nil
}
