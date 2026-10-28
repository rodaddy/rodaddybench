import { createHash } from "crypto";
import type { TestCase } from "./schema.ts";
import { TestCaseSchema } from "./schema.ts";

/**
 * Hash a test case based on content-meaningful fields only.
 * Ignores metadata (tags, dates) so hashes stay stable across
 * metadata-only edits.
 *
 * Returns a 16-character hex digest (SHA-256 truncated).
 */
export function hashTestCase(testCase: TestCase): string {
  // Extract content-meaningful fields based on scoring method
  const contentFields: Record<string, unknown> = {
    prompt: testCase.prompt,
    scoringMethod: testCase.scoringMethod,
  };

  if ("goldenAnswer" in testCase) {
    contentFields.goldenAnswer = testCase.goldenAnswer;
  }

  if ("rubric" in testCase) {
    contentFields.rubric = testCase.rubric;
  }

  const content = JSON.stringify(contentFields);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Read a test case file, validate it, and return its content hash.
 * Hashes the validated (canonical) form, not raw file bytes.
 */
export async function hashTestCaseFile(filePath: string): Promise<string> {
  const raw = await Bun.file(filePath).json();
  const testCase = TestCaseSchema.parse(raw);
  return hashTestCase(testCase);
}
