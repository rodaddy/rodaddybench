# How RodaddyBench was built

Sources: the private development repository's git history (129 commits,
2026-02-23 to 2026-10-27; 119 of them on the first two days), the planning
documents that history contains (requirements, roadmap, phase plans, UAT
reports), the code, and the tests. This public repository is a one-commit
snapshot; the planning folder is not included in it.

## The problem

Choosing a model for a job by reputation or a public leaderboard did not
match real work. The question was narrow: for the tasks actually done every
day (code review on TypeScript, Proxmox and Linux commands, technical
writing), which model gives the best answer, at what cost, and did that
change after the last model update?

## Timeline

| Date | Phase | What was built |
|------|-------|----------------|
| 2026-02-23 | Setup | Project initialised; domain research in four areas; 28 v1 requirements; a four-phase roadmap. |
| 2026-02-23 | Phase 1: core loop | Test-case schemas (Zod) with content hashing, the LiteLLM client, a deterministic scoring engine written test-first (failing tests committed before the scorer), the run pipeline and coloured terminal tables. |
| 2026-02-23 | Phase 2: judge | Vendor mapping and cross-vendor judge selection, rubric-based judge scoring with structured output, 16 code-review and content-generation test cases, Markdown reports. |
| 2026-02-23 | Phase 3: history | Run storage, `compare` with regression detection (also run automatically after each run), `history` with filters. |
| 2026-02-23 | Phase 4: enhancements | Cost tracking per answer, cached against non-cached model comparison, `trends` with sparklines and ASCII charts. |
| 2026-02-24 | v1.0 closed | Milestone recorded as 4 phases, 12 plans, 28 requirements, about 4,000 lines of TypeScript and 114 passing tests. |
| 2026-02-24 | v1.1, Phase 5: model identity | Aliases such as "sonnet" resolved to their real vendor through the proxy's model info, so the cross-vendor rule actually holds; router aliases excluded by configuration. |
| 2026-02-24 | Phase 6: scoring engine | Binary 0/1 judge scores replaced by a 1-10 rubric with described levels and per-criterion scores; infrastructure cases moved to weighted checklists with partial credit. |
| 2026-02-24 | Phase 7: bias | Every judged answer scored twice with positions swapped, inconsistent pairs flagged; a conciseness criterion and length metadata against verbosity bias. |
| 2026-02-24 | Phase 8: viewer | Per-criterion tables, a radar chart and bias flags in `viewer.html` and the CLI. |
| 2026-02-24 | Dashboard | SQLite storage alongside the JSON runs, `bench migrate`, and a Next.js dashboard (leaderboard, run detail, model trends, run comparison, cost against quality). |
| 2026-06 to 2026-10 | Housekeeping | Planning moved out of a hidden folder, TypeScript version standardised, agent instruction and search index changes, removal of a retired runtime. No benchmark logic changed. |

## Key design decisions

- **Score deterministically wherever there is a right answer.** Commands
  and structured output are checked by code; the LLM judge is only used for
  subjective quality.
- **A model never judges its own family.** The judge is chosen from a
  different vendor, and Phase 5 exists because proxy aliases had been
  hiding the real vendor and breaking that rule.
- **Partial credit, not pass/fail.** A command with five of six required
  parts is better than one with none, and the score should say so.
- **Control known judge biases.** Position swapping catches a judge that
  prefers whichever answer it reads first; the conciseness criterion stops
  long answers scoring higher for being long.
- **Content-hash every test case.** History stays comparable, and a changed
  case is visible as a changed case rather than a model regression.
- **Two storage formats.** JSON runs stay human-readable and diffable;
  SQLite gives the dashboard fast queries. Writes go to both.

## How AI was used

The build followed a structured, agent-driven workflow: for each phase,
research notes, a written plan per unit of work, execution in small
commits, then a verification step. Claude (Opus) wrote the code; 78 commits
carry its co-author line. Review was multi-agent and multi-model:

- A QA agent ran user-acceptance checks (the Phase 4 UAT records 12 of 12
  features verified).
- An adversarial ("antagonist") reviewer agent looked for edge cases. It
  found that a null model response crashed exact-match scoring and that an
  invalid regex in a test case threw an unhandled exception; both now score
  0. It also found missing cost fields on older stored runs.
- A Gemini 3.1 Pro code review of the scoring code led to a stricter
  structured-output schema for OpenAI compatibility, a regex capture-group
  fix, rounding of weighted scores, and removal of dead code.

## Testing

Unit and integration tests under `src/` and `tests/` run with `bun test`.
The offline set is 109 tests across 8 files (scorer, judge, vendor map,
reports, storage, CLI parsing, display). `tests/integration/pipeline.test.ts`
calls a live proxy. The v1.0 milestone recorded 114 passing tests at the
time.

## What did not work

- **Binary judge scores.** v1.0's 0/1 judging could not separate a good
  answer from an adequate one; the v1.1 milestone goal was to make results
  "actually meaningful", and Phase 6 replaced it.
- **All-or-nothing command checks.** One missing flag scored the same as a
  wrong command; checklists with weights fixed that.
- **Trusting model names.** Proxy aliases made a Claude model look like an
  unknown vendor, so it could be judged by Claude.
- **A single judge pass.** Without the swap, position bias in the judge was
  invisible.

## Current state

v1.1 complete with the dashboard; the benchmark logic has not changed since
2026-02-24. Three of the planned test categories exist. Results are kept
locally and are not published here.
