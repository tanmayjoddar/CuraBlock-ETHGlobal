package handlers

import (
	"Wallet/backend/services"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// OracleHandler exposes the NeuroShield Threat Oracle via REST endpoints.
type OracleHandler struct {
	oracleService *services.OracleService
}

// NewOracleHandler creates a new oracle handler.
func NewOracleHandler(oracleService *services.OracleService) *OracleHandler {
	return &OracleHandler{oracleService: oracleService}
}

// validAddress validates and normalises an Ethereum address from path params.
func (h *OracleHandler) validAddress(c *gin.Context) (string, bool) {
	addr := strings.TrimSpace(c.Param("address"))
	if addr == "" || len(addr) != 42 || !strings.HasPrefix(addr, "0x") {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid Ethereum address. Must be 42 characters starting with 0x.",
		})
		return "", false
	}
	return addr, true
}

// GetThreatScore handles GET /api/oracle/score/:address
func (h *OracleHandler) GetThreatScore(c *gin.Context) {
	addr, ok := h.validAddress(c)
	if !ok {
		return
	}

	score, err := h.oracleService.GetThreatScore(addr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query threat score: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address":   addr,
		"score":     score,
		"riskLabel": services.RiskLabelFor(score),
		"riskColor": services.RiskColorFor(score),
	})
}

// CheckConfirmedScam handles GET /api/oracle/check/:address
func (h *OracleHandler) CheckConfirmedScam(c *gin.Context) {
	addr, ok := h.validAddress(c)
	if !ok {
		return
	}

	confirmed, err := h.oracleService.IsConfirmedScam(addr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check scam status: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address":         addr,
		"isConfirmedScam": confirmed,
	})
}

// GetDAOConfidence handles GET /api/oracle/confidence/:address
func (h *OracleHandler) GetDAOConfidence(c *gin.Context) {
	addr, ok := h.validAddress(c)
	if !ok {
		return
	}

	confidence, err := h.oracleService.GetDAOConfidence(addr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get DAO confidence: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address":           addr,
		"votesFor":          confidence.VotesFor,
		"votesAgainst":      confidence.VotesAgainst,
		"totalVoters":       confidence.TotalVoters,
		"confidencePercent": confidence.ConfidencePercent,
	})
}

// GetFullOracleReport handles GET /api/oracle/full/:address
func (h *OracleHandler) GetFullOracleReport(c *gin.Context) {
	addr, ok := h.validAddress(c)
	if !ok {
		return
	}

	report, err := h.oracleService.GetFullOracleReport(addr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get oracle report: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}
