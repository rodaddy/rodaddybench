import { Badge } from "@/components/ui/badge";

interface PositionSwapData {
  delta: number;
  isConsistent: boolean;
  consistencyThreshold: number;
}

interface VerbosityMetadata {
  responseLength: number;
  goldenAnswerLength: number;
  lengthRatio: number;
}

interface BiasIndicatorProps {
  positionSwap?: PositionSwapData;
  verbosity?: VerbosityMetadata;
}

export function BiasIndicator({ positionSwap, verbosity }: BiasIndicatorProps) {
  const flags: Array<{ label: string; color: string }> = [];

  if (positionSwap && !positionSwap.isConsistent) {
    flags.push({
      label: `Position Bias (delta: ${(positionSwap.delta * 100).toFixed(1)}%)`,
      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    });
  }

  if (verbosity && verbosity.lengthRatio > 1.5) {
    flags.push({
      label: `Verbose (${verbosity.lengthRatio.toFixed(1)}x)`,
      color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    });
  }

  if (flags.length === 0) return null;

  return (
    <div className="flex gap-2">
      {flags.map((flag) => (
        <Badge key={flag.label} variant="outline" className={flag.color}>
          {flag.label}
        </Badge>
      ))}
    </div>
  );
}
