import { join } from "path";
import { TestCaseSchema, type TestCase } from "./schema.ts";
import { hashTestCase } from "./hash.ts";

export interface LoadedTestCase {
  testCase: TestCase;
  contentHash: string;
  filePath: string;
}

export interface LoadResult {
  cases: LoadedTestCase[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Load and validate a single test case file.
 * Throws on invalid JSON or schema validation failure.
 */
export async function loadTestCase(filePath: string): Promise<TestCase> {
  const raw = await Bun.file(filePath).json();
  return TestCaseSchema.parse(raw);
}

/**
 * Load all *.json test case files from a directory.
 * Collects successes and failures separately -- never throws on individual file errors.
 */
export async function loadTestCasesFromDirectory(
  dirPath: string,
): Promise<LoadResult> {
  const glob = new Bun.Glob("*.json");
  const cases: LoadedTestCase[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for await (const fileName of glob.scan({ cwd: dirPath })) {
    const filePath = join(dirPath, fileName);
    try {
      const raw = await Bun.file(filePath).json();
      const testCase = TestCaseSchema.parse(raw);
      cases.push({
        testCase,
        contentHash: hashTestCase(testCase),
        filePath,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ file: filePath, error: message });
    }
  }

  return { cases, errors };
}

/**
 * Load all test cases from the standard directory structure.
 * Scans all subdirectories under basePath (e.g., test-cases/infrastructure/).
 */
export async function loadAllTestCases(
  basePath = "test-cases",
): Promise<LoadResult> {
  const glob = new Bun.Glob("**/*.json");
  const cases: LoadedTestCase[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for await (const relativePath of glob.scan({ cwd: basePath })) {
    const filePath = join(basePath, relativePath);
    try {
      const raw = await Bun.file(filePath).json();
      const testCase = TestCaseSchema.parse(raw);
      cases.push({
        testCase,
        contentHash: hashTestCase(testCase),
        filePath,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ file: filePath, error: message });
    }
  }

  return { cases, errors };
}
