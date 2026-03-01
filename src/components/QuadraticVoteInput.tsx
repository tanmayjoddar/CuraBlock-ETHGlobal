import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Vote, Calculator } from "lucide-react";

interface QuadraticVoteInputProps {
  proposalId: number;
  maxTokens: string; // Wei string
  onVote: (
    proposalId: number,
    tokens: string,
    isApprove: boolean,
  ) => Promise<void>;
  isVoting?: boolean;
  className?: string;
}

const QuadraticVoteInput: React.FC<QuadraticVoteInputProps> = ({
  proposalId,
  maxTokens,
  onVote,
  isVoting = false,
  className = "",
}) => {
  const [tokens, setTokens] = useState("");
  const [votePower, setVotePower] = useState("0");

  // Calculate quadratic vote power when tokens change
  useEffect(() => {
    if (!tokens || isNaN(Number(tokens)) || Number(tokens) <= 0) {
      setVotePower("0");
      return;
    }

    // Square root of tokens for quadratic voting
    const power = Math.sqrt(Number(tokens));
    // Use enough decimals so small stakes don't round to 0.00
    setVotePower(power < 0.01 ? power.toFixed(6) : power.toFixed(2));
  }, [tokens]);

  // Format helper to display readable numbers
  // maxTokens arrives as a formatted ETH string (e.g. "999800.0"), NOT wei
  const formatDisplay = (num: string) => {
    try {
      const n = parseFloat(num);
      return isNaN(n) ? "0" : n.toLocaleString();
    } catch {
      return "0";
    }
  };

  // Raw numeric value (no commas) for HTML max attribute
  const rawMax = (() => {
    try {
      const n = parseFloat(maxTokens);
      return isNaN(n) ? undefined : n;
    } catch {
      return undefined;
    }
  })();

  const hasBalance = rawMax !== undefined && rawMax > 0;

  return (
    <Card
      className={`bg-black/20 backdrop-blur-lg border-white/10 ${className}`}
    >
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <Label>SHIELD Tokens to Stake</Label>
            <p className="text-sm text-gray-400">
              Available: {formatDisplay(maxTokens)} SHIELD
            </p>
          </div>
          <div className="text-right">
            <Label>Vote Power (√tokens)</Label>
            <div className="flex items-center space-x-1">
              <Calculator className="h-4 w-4 text-cyan-400" />
              <span className="text-cyan-400">{votePower}</span>
            </div>
          </div>
        </div>

        {!hasBalance && (
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs text-center">
            You need SHIELD tokens to vote. Acquire SHIELD tokens first.
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Input
            type="number"
            placeholder="Tokens to stake (vote power = √tokens)"
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            min="0"
            max={rawMax}
            step="any"
            disabled={isVoting || !hasBalance}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTokens(String(rawMax || 0))}
            disabled={isVoting || !hasBalance}
          >
            MAX
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button
            onClick={() => onVote(proposalId, tokens, true)}
            disabled={isVoting || !tokens || Number(tokens) <= 0 || !hasBalance}
            className="bg-green-600/20 hover:bg-green-600/30 border border-green-500/30"
          >
            <Vote className="h-4 w-4 mr-1" />
            {isVoting ? "Voting..." : "Confirm Scam"}
          </Button>
          <Button
            onClick={() => onVote(proposalId, tokens, false)}
            disabled={isVoting || !tokens || Number(tokens) <= 0 || !hasBalance}
            className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30"
          >
            <Vote className="h-4 w-4 mr-1" />
            {isVoting ? "Voting..." : "Not a Scam"}
          </Button>
        </div>

        {Number(tokens) > 0 && (
          <div className="text-center space-y-1">
            <Badge className="bg-cyan-500/20 text-cyan-400">
              √{Number(tokens).toLocaleString()} = {votePower} vote power
            </Badge>
            <p className="text-xs text-gray-500">
              Quadratic voting: power = square root of tokens staked
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuadraticVoteInput;
