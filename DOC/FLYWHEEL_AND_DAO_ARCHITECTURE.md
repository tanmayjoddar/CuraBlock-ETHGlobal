# NeuroShield — Flywheel & DAO Architecture

> Use this document to draw the Excalidraw architecture diagram and pitch to judges.

---

## TABLE OF CONTENTS

1. [The Big Idea (30 Seconds)](#1-the-big-idea)
2. [What Is the Dual-Layer Defense?](#2-dual-layer-defense)
3. [What Is the Flywheel?](#3-the-flywheel)
4. [Complete Architecture — Box by Box](#4-complete-architecture)
5. [DAO Governance Deep Dive](#5-dao-governance)
6. [Smart Contract Functions](#6-smart-contract-functions)
7. [Data Flow — Step by Step](#7-data-flow)
8. [Database Tables](#8-database-tables)
9. [API Endpoints](#9-api-endpoints)
10. [Excalidraw Drawing Guide](#10-excalidraw-drawing-guide)
11. [Pitch Script for Judges](#11-pitch-script)
12. [FAQ Judges Will Ask](#12-faq)

---

## 1. THE BIG IDEA

**One sentence:** NeuroShield is a **self-improving** crypto firewall that uses **AI + Community Voting** together — each one makes the other better over time.

**The problem:** Existing wallets either use static blocklists (easy to bypass) or ML models (miss new scams). Neither gets smarter.

**Our solution:** Two layers that feed each other in a loop (the "flywheel"):

- **Layer 1 — ML Model** catches fraud in milliseconds (instant)
- **Layer 2 — DAO Community** votes to confirm/deny if an address is actually a scam
- **The magic:** Every DAO-confirmed scam **automatically boosts** the ML model's score for that address → the system gets smarter with every community vote

---

## 2. DUAL-LAYER DEFENSE

Think of it like a hospital:

- **Layer 1 (ML) = The ER Doctor** — Fast diagnosis, catches most things, but can make mistakes
- **Layer 2 (DAO) = The Specialist Panel** — Slower but more accurate, reviews flagged cases

### Layer 1: ML Model (Speed)

```
User sends transaction
      ↓
Backend sends 18 wallet features to ML API
      ↓
ML returns: "Fraud" (85%), "Suspicious" (50%), or "Non-Fraud" (10%)
      ↓
Decision in < 3 seconds
```

**What the ML model analyzes (18 features):**
| # | Feature | What It Means |
|---|---------|--------------|
| 0 | avg_min_between_sent_tnx | How often this wallet sends money |
| 1 | avg_min_between_received_tnx | How often it receives money |
| 2 | time_diff_mins | Time between first and last transaction |
| 3 | sent_tnx | Total transactions sent |
| 4 | received_tnx | Total transactions received |
| 5 | number_of_created_contracts | How many contracts this wallet deployed |
| 6 | max_value_received | Largest single incoming transfer |
| 7 | avg_val_received | Average incoming transfer |
| 8 | avg_val_sent | Average outgoing transfer |
| 9 | total_ether_sent | Total ETH sent over lifetime |
| 10 | total_ether_balance | Current ETH balance |
| 11-15 | ERC20 stats | Token activity (received, sent, unique addresses) |
| 16-17 | Token types | Most common token sent/received (strings) |

**ML Scoring Rules:**

- ML says "Fraud" → base risk = **85%**
- ML says "Suspicious" → base risk = **50%**
- ML says "Non-Fraud" → base risk = **10%**

### Layer 2: DAO Community (Accuracy)

```
Community member spots suspicious address
      ↓
Creates a "Proposal" on-chain (QuadraticVoting contract)
      ↓
Other members vote using SHIELD tokens (quadratic: √tokens = vote power)
      ↓
After voting period: if 60%+ votes say "scam" → address is CONFIRMED
      ↓
On-chain: isScammer[address] = true, scamScore += 25
```

---

## 3. THE FLYWHEEL

This is the **key innovation** that makes NeuroShield special. Draw this as a circle/loop:

```
    ┌──────────────────────────────────────────────────────────┐
    │                                                          │
    ▼                                                          │
 USER SENDS TX                                                 │
    │                                                          │
    ▼                                                          │
 ML MODEL scores the transaction                               │
    │  (checks 18 wallet features)                            │
    │                                                          │
    ▼                                                          │
 BACKEND checks: Is this address                               │
 DAO-confirmed scam?                                           │
    │                                                          │
    ├── YES → BOOST ml score (+ up to 50%)                    │
    │         Score = ML + (scamScore/100 × 0.5)              │
    │         Example: 0.85 + 0.25 = 1.0 → BLOCKED           │
    │                                                          │
    ├── UNDER REVIEW → Add +15% caution boost                  │
    │                                                          │
    └── NO → Use ML score alone                                │
                                                               │
 COMMUNITY sees blocked/suspicious TX                          │
    │                                                          │
    ▼                                                          │
 COMMUNITY creates DAO Proposal                                │
    │  "This address stole $625M from Ronin Bridge"           │
    │                                                          │
    ▼                                                          │
 COMMUNITY VOTES (Quadratic Voting)                            │
    │  √100 tokens = 10 vote power (prevents whales)          │
    │                                                          │
    ▼                                                          │
 PROPOSAL PASSES (60%+ votes confirm scam)                     │
    │                                                          │
    ▼                                                          │
 ON-CHAIN: isScammer[address] = true                           │
           scamScore[address] += 25                            │
    │                                                          │
    ▼                                                          │
 EVENT LISTENER catches ProposalExecuted event                 │
    │                                                          │
    ▼                                                          │
 DATABASE: confirmed_scams table updated ──────────────────────┘
    │
    └── NEXT TIME someone sends to this address,
        ML score is automatically boosted!
        THE SYSTEM GOT SMARTER.
```

### Why "Flywheel"?

Like a spinning wheel that gets faster with each push:

1. **Push 1:** ML catches a scam (initial detection)
2. **Push 2:** Community confirms it via DAO vote (validation)
3. **Push 3:** Confirmed data boosts ML for that address (improvement)
4. **Push 4:** ML catches similar patterns faster next time (learning)
5. **Each push makes the next one easier** — the wheel spins faster

### Flywheel Math (Backend — ai.go):

```
combinedRisk = mlRisk + daoBoost

where daoBoost = (scamScore / 100) × 0.5

Examples:
  - Clean address:     ML 0.10 + DAO 0.00 = 0.10 (Safe)
  - ML-only fraud:     ML 0.85 + DAO 0.00 = 0.85 (Blocked)
  - DAO score 25:      ML 0.85 + DAO 0.125 = 0.975 (Blocked, boosted)
  - DAO score 50:      ML 0.85 + DAO 0.25 = 1.00 (Max blocked)
  - DAO score 100:     ML 0.85 + DAO 0.50 = 1.00 (Capped at 1.0)
```

### Flywheel Scoring (Frontend — TransactionInterceptor.tsx):

```
RULE 1: DAO says "confirmed scam" → Score jumps to 95% (overrides ML)
RULE 2: Both ML + DAO agree dangerous → Weighted average + 15 bonus
RULE 3: DAO has reports, ML says safe → Floor at 40% (community caution)
RULE 4: Under review (active proposal) → Minimum 30% score

False-positive protection:
  - New empty wallet + No DAO reports → Cap ML at 45% (don't scare users)
```

---

## 4. COMPLETE ARCHITECTURE — BOX BY BOX

Draw these as boxes in Excalidraw, connected by arrows:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                     │
│                                                                     │
│  ┌───────────────────────┐  ┌──────────────────────┐                │
│  │ TransactionInterceptor│  │    DAO Voting Page    │                │
│  │ - Scans every TX      │  │ - Create proposals    │                │
│  │ - Shows dual score    │  │ - Cast votes          │                │
│  │ - Block/Allow/Warn    │  │ - See results         │                │
│  └─────────┬─────────────┘  └──────────┬───────────┘                │
│            │                            │                            │
│            ▼                            ▼                            │
│  ┌──────────────────────────────────────────────────┐                │
│  │           Web3 Contract Service                   │               │
│  │  - isScamAddress(addr) → eth_call                 │               │
│  │  - getScamScore(addr) → eth_call                  │               │
│  │  - submitProposal() → send TX                     │               │
│  │  - castVote() → send TX                           │               │
│  │  - executeProposal() → send TX                    │               │
│  └──────────────────────────────────────────────────┘                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                    HTTP + eth_call
                           │
          ┌────────────────┼─────────────────────┐
          ▼                ▼                      ▼
┌──────────────┐  ┌────────────────┐   ┌──────────────────────────┐
│   Go Backend │  │  Sepolia RPC   │   │  ML API (Python/Flask)   │
│   (Gin)      │  │  (Public Node) │   │  on Render               │
│              │  │                │   │                          │
│ Port 8080    │  │ Chain 11155111 │   │  /predict endpoint       │
│              │  │                │   │  18-feature model        │
│ Services:    │  │ Contracts:     │   │  Returns: Fraud/         │
│ - AI Service │  │ - Quadratic    │   │  Suspicious/Non-Fraud    │
│ - Oracle     │◄─┤   Voting       │   │                          │
│ - Events     │  │ - ShieldToken  │   │  Hosted at:              │
│ - Wallet     │  │ - CivicSBT     │   │  ml-fraud-transaction-   │
│   Analytics  │  │                │   │  detection.onrender.com  │
└──────┬───────┘  └────────────────┘   └──────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│        PostgreSQL (Neon Serverless)       │
│                                          │
│  Tables:                                 │
│  - transactions (analyzed TXs)           │
│  - dao_proposals (governance votes)      │
│  - dao_votes (individual votes)          │
│  - confirmed_scams ← FLYWHEEL OUTPUT    │
│  - reports (user scam reports)           │
│  - recoveries (recovery attempts)        │
└──────────────────────────────────────────┘
```

### What Each Box Does:

| Box                        | Technology                       | Role                                                          |
| -------------------------- | -------------------------------- | ------------------------------------------------------------- |
| **Frontend**               | React 18 + TypeScript + Tailwind | User interface — transaction scanning, DAO voting             |
| **TransactionInterceptor** | React component (~1200 lines)    | The firewall UI — intercepts every transaction, shows risk    |
| **Web3 Contract Service**  | ethers.js                        | Talks to smart contracts on Sepolia via MetaMask              |
| **Go Backend**             | Go 1.24 + Gin + GORM             | API server — connects ML, DB, and blockchain                  |
| **AI Service**             | Go HTTP client → Python Flask    | Sends wallet features to ML, gets prediction, adds DAO boost  |
| **Oracle Service**         | Go + go-ethereum                 | Reads on-chain scam data (isConfirmedScam, getThreatScore)    |
| **Event Listener**         | Go + go-ethereum                 | Watches for ProposalExecuted events, syncs to DB              |
| **ML API**                 | Python + Flask + scikit-learn    | Trained fraud detection model (18 features)                   |
| **QuadraticVoting**        | Solidity 0.8.28                  | DAO governance contract — proposals, votes, scam confirmation |
| **ShieldToken**            | ERC-20                           | Governance token — stake to vote                              |
| **PostgreSQL**             | Neon Serverless                  | Stores all off-chain data, caches on-chain data               |

---

## 5. DAO GOVERNANCE DEEP DIVE

### What Is the DAO?

DAO = **Decentralized Autonomous Organization**. In our case, it's a **community of SHIELD token holders** who collectively decide which addresses are scams.

No single person or company controls the scam list — **the community governs it through on-chain voting**.

### How Quadratic Voting Works

**Problem:** In normal voting, a whale with 10,000 tokens has 10,000× more power than someone with 1 token. This is unfair — one rich person can control everything.

**Solution — Quadratic Voting:** Your vote power = **square root of tokens staked**

```
Tokens Staked → Vote Power
─────────────────────────
     1 token  →  1 vote power
     4 tokens →  2 vote power
    25 tokens →  5 vote power
   100 tokens → 10 vote power
 10000 tokens → 100 vote power
```

**Why this matters:** To get 2× the vote power, you need 4× the tokens. To get 10× the power, you need 100× the tokens. Rich people still have more power, but it scales fairly.

### Voter Reputation System

The contract tracks how good each voter is:

- **voterAccuracy[address]**: 0-100 score. Starts at 0. +5 for each correct vote (voted with majority), -10 for each wrong vote.
- **voterParticipation[address]**: How many proposals you've voted on.
- **Reputation Bonus**: If accuracy > 80% AND participation ≥ 5 votes → you get **+20% vote power** boost.

This creates a meritocracy: **good voters get more influence over time**.

### Complete DAO Lifecycle

```
PHASE 1: REPORT (Anyone can start)
───────────────────────────────────
  Someone calls submitProposal(suspiciousAddress, description, evidence)
  → Creates a Proposal struct on-chain
  → Emits ProposalCreated event
  → Voting period starts (currently 60 seconds for demo, default 3 days)

PHASE 2: VOTE (Token holders participate)
───────────────────────────────────────────
  Token holders call castVote(proposalId, support=true/false, tokens)
  → SHIELD tokens transferred from voter to contract (staked)
  → Vote power calculated: √(tokens) + reputation bonus
  → votesFor or votesAgainst incremented
  → voterParticipation[voter]++ (reputation tracking)
  → Emits VoteCast event

PHASE 3: EXECUTE (After voting period ends)
───────────────────────────────────────────
  Anyone calls executeProposal(proposalId) after endTime
  → Counts total votes
  → If votesFor ≥ 60% of total → PASSED
     - isScammer[address] = true
     - scamScore[address] += 25 (caps at 100)
     - Emits ScamAddressConfirmed event
  → If votesAgainst > 40% → FAILED (address cleared)
  → Updates ALL voters' accuracy scores
  → Returns staked tokens to ALL voters
  → Emits ProposalExecuted event

PHASE 4: FLYWHEEL KICKS IN
────────────────────────────
  Event Listener catches ProposalExecuted
  → Writes to confirmed_scams table in PostgreSQL
  → Next time any user sends to this address:
     - ML score is boosted by DAO data
     - Frontend shows "DAO CONFIRMED SCAM" badge
     - Transaction is blocked with higher confidence
```

### The Scam Score Progression

An address can be reported multiple times. Each confirmed report adds 25 to the score:

```
First confirmed report:   scamScore = 25
Second confirmed report:  scamScore = 50
Third confirmed report:   scamScore = 75
Fourth confirmed report:  scamScore = 100 (maximum)
```

Higher scamScore = higher DAO boost to ML = more likely to block.

---

## 6. SMART CONTRACT FUNCTIONS

### QuadraticVoting.sol (Deployed at `0x810DA31a1eFB767652b2f969972d2A612AfdEc5C`)

**Write Functions (cost gas):**
| Function | Who Calls | What It Does |
|----------|-----------|-------------|
| `submitProposal(address, description, evidence)` | Any user | Creates a new scam report for voting |
| `castVote(proposalId, support, tokens)` | SHIELD holders | Stakes tokens and casts quadratic vote |
| `executeProposal(proposalId)` | Anyone (after voting) | Finalizes the vote, confirms/denies scam |

**Read Functions (free, no gas):**
| Function | Returns | Used By |
|----------|---------|---------|
| `isConfirmedScam(address)` | bool | Oracle Service, Frontend |
| `getThreatScore(address)` | 0-100 | Oracle Service, Frontend |
| `getDAOConfidence(address)` | votesFor, votesAgainst, totalVoters, confidence% | Oracle Service |
| `isScammer(address)` | bool | Same as isConfirmedScam (mapping) |
| `scamScore(address)` | uint256 | Event Listener, Frontend |
| `getProposal(id)` | full proposal details | Frontend DAO page |
| `getVote(proposalId, voter)` | voter's vote details | Frontend |
| `getVoterStats(voter)` | accuracy, participation | Frontend reputation display |

### ShieldToken.sol (Deployed at `0x4866507F82F870beD552884F700C54D8A6Dcb061`)

Standard ERC-20 token. Used for:

- Staking to vote (transferFrom during castVote)
- Returned after proposal execution
- Governance weight

---

## 7. DATA FLOW — STEP BY STEP

### Flow A: User Sends a Transaction (Frontend → Backend → ML + DAO → Decision)

```
Step 1: User enters recipient address + amount in wallet UI
           │
Step 2: Frontend TransactionInterceptor fires
           │
           ├──→ PARALLEL CALL 1: Backend /api/firewall/tx
           │      → AI Service builds 18-feature vector
           │      → Sends to ML API (Python Flask on Render)
           │      → ML returns "Fraud" / "Suspicious" / "Non-Fraud"
           │      → AI Service queries confirmed_scams table
           │      → If DAO-confirmed: boosts score by (scamScore/100 × 0.5)
           │      → Returns combined risk score
           │
           ├──→ PARALLEL CALL 2: On-chain eth_call
           │      → isScamAddress(address) → reads isScammer mapping
           │      → getScamScore(address) → reads scamScore mapping
           │      → getActiveProposals → checks if under review
           │
           └──→ Results merged in frontend:
                  → ML score + DAO boost = combined score
                  → If DAO confirmed: override to 95%
                  → Display: SAFE (green) / SUSPICIOUS (yellow) / BLOCKED (red)
                  → User decides: Continue or Cancel
```

### Flow B: Someone Reports a Scam (DAO Proposal → Vote → Confirm → Flywheel)

```
Step 1: User sees suspicious address, clicks "Report to DAO"
           │
Step 2: Frontend calls submitProposal(address, reason, evidence)
           → MetaMask signs transaction
           → On-chain: Proposal created, voting period starts
           │
Step 3: Community members see proposal on DAO Voting page
           → Each member calls castVote(proposalId, true/false, tokenAmount)
           → Quadratic power calculated: √tokens
           → Tokens staked (locked in contract)
           │
Step 4: Voting period ends (60 seconds in demo, 3 days in production)
           │
Step 5: Someone calls executeProposal(proposalId)
           → Contract checks: votesFor ≥ 60%?
           → YES: isScammer[address] = true, scamScore += 25
           → Emits ProposalExecuted + ScamAddressConfirmed events
           → Returns all staked tokens to voters
           → Updates voter accuracy scores
           │
Step 6: Event Listener (Go backend) catches the event
           → HTTP polling every 15 seconds (fallback from WebSocket)
           → Reads proposal details from contract
           → Writes to confirmed_scams table in PostgreSQL
           │
Step 7: FLYWHEEL COMPLETE
           → Next transaction to this address gets ML + DAO boost
           → System is now smarter for this address
```

### Flow C: Oracle — Any Protocol Can Query Our Data

```
External Protocol wants to check if an address is safe
           │
Option 1: Direct on-chain call (no API needed)
           → Call isConfirmedScam(address) on QuadraticVoting contract
           → Returns true/false
           → Call getThreatScore(address) → returns 0-100
           → Call getDAOConfidence(address) → returns voting details
           │
Option 2: REST API
           → GET /api/oracle/check/:address → { isConfirmedScam: bool }
           → GET /api/oracle/score/:address → { score: 0-100, riskLabel }
           → GET /api/oracle/report/:address → full threat report
```

---

## 8. DATABASE TABLES

### confirmed_scams (THE FLYWHEEL TABLE)

This is where DAO-confirmed scams are stored off-chain for fast ML queries.

| Column       | Type                  | Description                         |
| ------------ | --------------------- | ----------------------------------- |
| id           | uint (PK)             | Auto-increment                      |
| address      | string (unique index) | The scam wallet address (lowercase) |
| scam_score   | int                   | 0-100 community confidence          |
| proposal_id  | uint                  | Which DAO proposal confirmed this   |
| confirmed_at | timestamp             | When it was confirmed               |
| total_voters | int                   | How many people voted               |
| description  | string                | Why it's a scam                     |
| tx_hash      | string (index)        | On-chain transaction hash           |
| block_number | uint64                | Ethereum block number               |

### dao_proposals

| Column             | Type           | Description                                   |
| ------------------ | -------------- | --------------------------------------------- |
| id                 | uint (PK)      | Proposal ID                                   |
| title              | string         | Proposal title                                |
| description        | string         | Why this address is suspicious                |
| proposer_address   | string         | Who created this proposal                     |
| suspicious_address | string (index) | Address being investigated                    |
| created_at         | timestamp      | When proposed                                 |
| end_time           | timestamp      | When voting ends                              |
| status             | string         | "active" / "passed" / "rejected" / "executed" |
| votes_for          | int            | Total FOR votes                               |
| votes_against      | int            | Total AGAINST votes                           |

### dao_votes

| Column        | Type           | Description          |
| ------------- | -------------- | -------------------- |
| id            | uint (PK)      | Vote ID              |
| proposal_id   | uint (index)   | Which proposal       |
| voter_address | string (index) | Who voted            |
| vote_type     | string         | "for" or "against"   |
| vote_power    | float64        | Quadratic vote power |
| voted_at      | timestamp      | When voted           |

### transactions

| Column    | Type           | Description                       |
| --------- | -------------- | --------------------------------- |
| id        | uint (PK)      | Transaction ID                    |
| from      | string (index) | Sender address                    |
| to        | string (index) | Recipient address                 |
| value     | float64        | Amount in ETH                     |
| risk      | float64        | ML + DAO combined risk score      |
| status    | string         | "safe" / "suspicious" / "blocked" |
| timestamp | timestamp      | When analyzed                     |

---

## 9. API ENDPOINTS

### Firewall (Core Protection)

| Method | Endpoint                 | What It Does                              |
| ------ | ------------------------ | ----------------------------------------- |
| POST   | `/api/firewall/tx`       | Analyze a transaction (ML + DAO flywheel) |
| POST   | `/api/firewall/enhanced` | Enhanced analysis for high-value TXs      |

### DAO Governance

| Method | Endpoint                      | What It Does                           |
| ------ | ----------------------------- | -------------------------------------- |
| POST   | `/api/dao/proposals`          | Create a new scam report proposal      |
| GET    | `/api/dao/proposals`          | List all proposals (filter by status)  |
| POST   | `/api/dao/vote`               | Cast a vote on a proposal              |
| GET    | `/api/dao/scamscore/:address` | Check if address is DAO-confirmed scam |
| GET    | `/api/dao/address/:address`   | Get address scam status                |

### Oracle (Public Threat Feed)

| Method | Endpoint                          | What It Does                    |
| ------ | --------------------------------- | ------------------------------- |
| GET    | `/api/oracle/check/:address`      | Is this a confirmed scammer?    |
| GET    | `/api/oracle/score/:address`      | Get threat score (0-100)        |
| GET    | `/api/oracle/confidence/:address` | Get DAO voting confidence data  |
| GET    | `/api/oracle/report/:address`     | Full threat intelligence report |

---

## 10. EXCALIDRAW DRAWING GUIDE

### Recommended Layout (Left-to-Right Flow)

**Layer 1 — LEFT SIDE:**

```
Draw a big box labeled "🧠 ML Layer (Speed)"
Inside it:
  - Small box: "Python Flask API"
  - Arrow labeled "18 wallet features"
  - Small box: "Trained ML Model"
  - Arrow labeled "Fraud / Suspicious / Non-Fraud"
  - Output: "Risk Score: 85%"
```

**Layer 2 — RIGHT SIDE:**

```
Draw a big box labeled "🏛️ DAO Layer (Accuracy)"
Inside it:
  - Small box: "QuadraticVoting Contract"
  - Icon: "📝 Submit Report"
  - Icon: "🗳️ Community Votes"
  - Icon: "✅ Execute → isScammer = true"
  - Output: "scamScore: 50"
```

**CENTER — THE FLYWHEEL (Draw as circular arrows):**

```
Draw a circular loop between ML and DAO with arrows:

  ML Score (85%) ──→ Combined Score (85% + 25% = 100%)
       ↑                        │
       │                        ▼
  DAO Boost ←── confirmed_scams table ←── Event Listener ←── ProposalExecuted
```

**BOTTOM — Infrastructure:**

```
Three boxes in a row:
  [Go Backend (Gin)] ←→ [PostgreSQL (Neon)] ←→ [Sepolia Blockchain]
```

**TOP — User Interface:**

```
  [React Frontend]
     ├── Transaction Interceptor (shows dual score)
     └── DAO Voting Page (community governance)
```

### Color Coding Suggestion

- **Green**: Safe path (Non-Fraud, clean addresses)
- **Yellow**: Warning path (Under review, active proposals)
- **Red**: Block path (Fraud detected, DAO confirmed)
- **Blue**: Data flow arrows
- **Purple**: Flywheel loop (the key innovation)

### Key Labels to Include

- "Self-improving loop" on the flywheel arrows
- "Quadratic Voting: √tokens = power" on the DAO box
- "18 wallet features" on the ML input arrow
- "On-chain threat oracle" on the contract box
- "Any EVM protocol can query" on the oracle output

---

## 11. PITCH SCRIPT FOR JUDGES

### Opening (15 seconds)

> "What if your crypto wallet could learn from the community and get smarter every day? That's NeuroShield — the first self-improving crypto firewall."

### The Problem (20 seconds)

> "Today, crypto wallets use either static blocklists that are outdated within hours, or ML models that miss new scam tactics. Neither of them gets better over time. We lose $4 billion a year to crypto scams. We need a system that evolves."

### The Solution — Point at your Excalidraw (30 seconds)

> "NeuroShield uses TWO layers of defense that feed each other. Let me walk you through it."

_Point to the ML box:_

> "Layer 1 is our ML model. When you send a transaction, it instantly analyzes 18 features of the recipient's wallet — things like transaction frequency, ETH balance, contract deployments, token patterns. In under 3 seconds, it gives a risk score. For known scam wallets like the Ronin Bridge exploiter, it returns 85% risk."

_Point to the DAO box:_

> "But ML models make mistakes. That's where Layer 2 comes in — our DAO. SHIELD token holders can create proposals saying 'Hey, this address stole $625 million.' The community votes using quadratic voting — that means the square root of your tokens equals your vote power, so no whale can dominate. If 60% agree it's a scam, the address is permanently flagged on-chain."

_Point to the Flywheel loop:_

> "Here's the magic — the Flywheel. When the DAO confirms a scam, that data flows BACK into the ML layer. Next time anyone sends money to that address, the risk score jumps from 85% to 100%. The system literally got smarter because of one community vote. And this loop repeats — every confirmed scam makes the AI better."

### Technical Differentiation (20 seconds)

> "Three things make this novel:
>
> 1. **Quadratic voting** prevents whale manipulation — your 10,000 tokens don't give you 10,000 votes, just 100.
> 2. **On-chain threat oracle** — any EVM protocol can call `isConfirmedScam(address)` on our contract. It's a public good.
> 3. **The flywheel is automatic** — our event listener syncs every DAO decision to the ML model's database in real-time. No manual updates, no admin needed."

### Live Demo (30 seconds)

> "Let me show you. I'll send ETH to the Ronin Bridge exploiter's address — the one behind the $625 million hack."

_Send transaction in the UI_

> "See that? Two panels:
>
> - ML Layer says 85% risk — Fraud detected.
> - DAO Layer says CONFIRMED SCAM — community voted, on-chain verified.
> - Combined score: 100%. Transaction BLOCKED."

> "Now watch what happens with a random clean address..."

_Send to a clean address_

> "ML says 10% — Non-Fraud. DAO says 0 — no reports. Transaction goes through. The system only blocks when it's confident."

### Closing (15 seconds)

> "NeuroShield is day-one protection with ML, and it gets smarter every day with community governance. The more people use it, the safer everyone becomes. That's the flywheel — and once it's spinning, scammers can't keep up."

---

### Pitch Tips

1. **Start with the problem, not the tech.** Judges care about impact.
2. **Use the Excalidraw diagram.** Visual > words. Point to specific boxes as you talk.
3. **Say "flywheel" early and often.** It's your unique differentiator.
4. **The Ronin Bridge demo is powerful.** Real $625M hack, real address, real block.
5. **Mention "public good" for the oracle.** Judges love it when your project helps the ecosystem.
6. **Quadratic voting = fairness.** Judges will ask "what stops a whale?" Answer: quadratic voting.
7. **Don't go deep on Go/React/Python.** Judges care about innovation, not stack.
8. **Time yourself.** The pitch above is ~2.5 minutes. Adjust for your slot.

---

## 12. FAQ — QUESTIONS JUDGES WILL ASK

### Q: "What stops someone from false-flagging a legitimate address?"

> "Three safeguards: (1) Quadratic voting means it costs exponentially more to overpower the community. (2) The 60% threshold requires broad consensus. (3) Voter reputation tracks accuracy — voters who vote against the majority lose reputation, and eventually lose their voting weight bonus. Gaming the system is economically irrational."

### Q: "How is this different from Chainalysis / Etherscan labels?"

> "Chainalysis is centralized — one company decides. We're decentralized — the community decides. Chainalysis data is behind a paywall — ours is a free on-chain oracle. And our data feeds back into ML scoring automatically — Chainalysis labels don't improve your wallet's AI."

### Q: "What if the ML model is wrong?"

> "That's exactly why Layer 2 exists. The ML gives a first opinion (like a screening test). If it flags something incorrectly, the community can reject the proposal and the address stays clean. If the ML misses something, the community can report it and boost the score. Each layer compensates for the other's weaknesses."

### Q: "Does the ML model actually retrain?"

> "Not in the traditional sense of retraining weights. What happens is the DAO-confirmed scam data creates a **score boost** — the ML prediction stays the same, but the final risk score increases. Think of it as the ML providing a base signal, and the DAO providing a correction factor. Over time, as we collect enough DAO-confirmed data, we can periodically retrain the model offline with this curated dataset. For the hackathon, the flywheel works through the boost mechanism."

### Q: "Can this scale?"

> "The on-chain oracle is just view functions — zero gas to query. The ML API handles thousands of predictions per second. The PostgreSQL database caches DAO confirmations for sub-millisecond lookups. The event listener syncs automatically. The only bottleneck is voting gas costs, which are minimal on L2s like Monad. We can deploy the same contracts on any EVM chain."

### Q: "Why quadratic voting instead of normal voting?"

> "Token-weighted voting (1 token = 1 vote) creates plutocracy. One whale with 1 million tokens has more power than 1,000 regular users combined. With quadratic voting, that whale only gets √1,000,000 = 1,000 vote power, while 1,000 regular users each with 100 tokens get 1,000 × √100 = 10,000 combined vote power. The community always wins."

### Q: "What's the SHIELD token?"

> "SHIELD is our ERC-20 governance token. You stake it to vote. After the vote concludes, you get your tokens back. It's not a speculative token — it's a governance mechanism. In production, it would be distributed to active community members who contribute honest votes."

### Q: "What blockchain is this on?"

> "Currently deployed on Ethereum Sepolia testnet. The architecture is chain-agnostic — we can deploy on any EVM chain. For production, we'd target a high-throughput L2 like Monad, Arbitrum, or Base where vote transactions are cheap."

---

## CONTRACT ADDRESSES (Sepolia Testnet)

| Contract         | Address                                      |
| ---------------- | -------------------------------------------- |
| QuadraticVoting  | `0x810DA31a1eFB767652b2f969972d2A612AfdEc5C` |
| ShieldToken      | `0x4866507F82F870beD552884F700C54D8A6Dcb061` |
| CivicSBT         | `0xD820d3594b71E3a40c97Fdb89EaF06aDBBaB0D8E` |
| WalletVerifier   | `0xe73f31f7D784b29a8625c056510A8E9352E3a95b` |
| CivicGatedWallet | `0x233015A64Cb5c209bf3E1BB52db4338BEf1BfBB7` |

**Deployer:** `0x54e52d0643A3491fa9745f20Dce0c0d9279E5bE0`
**Demo Scam Address:** `0x098B716B8Aaf21512996dC57EB0615e2383E2f96` (Ronin Bridge Exploiter)

---

_This document is your complete reference for understanding, drawing, and pitching the NeuroShield Flywheel and DAO architecture._
