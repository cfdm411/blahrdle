Review the current codebase state and propose updates to CLAUDE.md 
and README.md where needed.

File purposes — never mix these:

CLAUDE.md → internal working document for AI agents.
  Contains: architecture decisions, conventions, known bugs,
  test gaps, security decisions, debt, timing contracts.
  Audience: Claude, Composer, any AI working on this codebase.

README.md → public-facing product and setup documentation.
  Contains: what the product does, how to run it, how to deploy,
  feature list, test count, project structure.
  Audience: humans onboarding to the project.

Rules:
- Internal debt, bugs, and AI conventions → CLAUDE.md only
- Feature changes, test count, setup changes → README.md only
- Architecture decisions that affect onboarding → both, 
  but README gets the what, CLAUDE.md gets the why and the risk

Output: proposed diff per file, minimal and precise.
Do not rewrite sections that are still accurate.
Wait for approval before making any changes.
