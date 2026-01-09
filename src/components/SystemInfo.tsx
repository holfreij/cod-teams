import { useState, useEffect } from "react";
import { Card, Heading } from "@chakra-ui/react";
import { getHandicapCoefficient } from "../storage";

interface SystemInfoProps {
  version?: number;
}

export const SystemInfo = ({ version = 0 }: SystemInfoProps) => {
  const [handicapCoefficient, setHandicapCoefficient] = useState<number | null>(null);

  useEffect(() => {
    const loadCoefficient = async () => {
      const coefficient = await getHandicapCoefficient();
      setHandicapCoefficient(coefficient);
    };
    loadCoefficient();
  }, [version]);

  if (handicapCoefficient === null) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl">
      <Card.Root className="shadow-xl border border-blue-700/50 transition-all duration-300 hover:border-blue-600/50">
        <Card.Body className="flex flex-col gap-3">
          <Heading className="text-xl md:text-2xl font-bold text-gray-100">
            ⚖️ Uneven Team Handicap System
          </Heading>

          <div className="text-gray-300 space-y-2">
            <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-700/30">
              <span className="font-semibold">Current Coefficient:</span>
              <span className="text-2xl font-bold text-blue-400">{Math.round(handicapCoefficient)}</span>
            </div>

            <div className="text-sm text-gray-400 space-y-1 pt-2">
              <p>
                🎯 <strong>How it works:</strong> When teams are uneven (e.g., 2v3), the smaller team receives an ELO handicap to balance the match.
              </p>
              <p>
                📊 <strong>Formula:</strong> Handicap = Coefficient × (1 - SmallerTeam/LargerTeam)
              </p>
              <div className="pl-4 space-y-1">
                <p>• 2v3 match: {Math.round(handicapCoefficient * (1 - 2/3))} ELO points to smaller team</p>
                <p>• 5v6 match: {Math.round(handicapCoefficient * (1 - 5/6))} ELO points to smaller team</p>
              </div>
              <p className="pt-2">
                🤖 <strong>Auto-adjusting:</strong> This coefficient automatically adjusts after each uneven match based on the outcome, ensuring fair gameplay over time.
              </p>
            </div>
          </div>
        </Card.Body>
      </Card.Root>
    </div>
  );
};
