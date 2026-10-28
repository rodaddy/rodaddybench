import type { Result } from "@/lib/types";
import { formatScore } from "@/lib/format";
import { BiasIndicator } from "./bias-indicator";

interface ResponseViewerProps {
  result: Result;
}

export function ResponseViewer({ result }: ResponseViewerProps) {
  const judge = result.judgeMetadata;

  return (
    <div className="space-y-4 p-4">
      {/* Response text */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-zinc-400">Response</h4>
        <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-900 p-4 font-mono text-xs text-zinc-300">
          {result.response}
        </pre>
      </div>

      {judge && (
        <>
          {/* Judge reasoning */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-400">
              Judge Reasoning ({judge.judgeModel}) - Confidence:{" "}
              {formatScore(judge.judgeConfidence)}
            </h4>
            <p className="rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
              {judge.judgeReasoning}
            </p>
          </div>

          {/* Criterion breakdown */}
          {judge.criterionBreakdown && judge.criterionBreakdown.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-zinc-400">
                Criterion Scores
              </h4>
              <div className="space-y-2">
                {judge.criterionBreakdown.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span
                      className="w-40 text-xs text-zinc-400 truncate"
                      title={c.description}
                    >
                      {c.name}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${(c.score / c.maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-16 text-right">
                      {c.score}/{c.maxScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bias flags */}
          <BiasIndicator
            positionSwap={judge.positionSwap}
            verbosity={judge.verbosityMetadata}
          />
        </>
      )}

      {/* Checklist metadata */}
      {result.checklistMetadata && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-zinc-400">
            Checklist: {result.checklistMetadata.itemsMatched}/
            {result.checklistMetadata.itemsTotal} items matched
          </h4>
          <div className="space-y-1">
            {result.checklistMetadata.itemResults.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <span
                  className={item.matched ? "text-green-400" : "text-red-400"}
                >
                  {item.matched ? "+" : "-"}
                </span>
                <span className="text-zinc-400">{item.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
