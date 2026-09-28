# Practice Exam Simulator

The static practice exam app in this folder is designed for GitHub Pages hosting and reads its question bank from `questions.json`.

## Real exam profile defaults

The simulator now defaults to a profile that more closely mirrors official GH-300 conditions:

- 65 questions
- 100 minute timer
- Passing score of 700/1000 (scaled)
- Mixed question styles surfaced in the UI (multiple-choice, multiple-response, and scenario-based workflow)

## Exam assembly behavior

- Questions are deduplicated by ID and normalized content fingerprint before exam generation.
- Exam generation uses weighted domain sampling aligned with the GH-300 skill mix and then fills any shortfall from the remaining pool.
- Cross-exam repeat avoidance can be configured in the UI (`Avoid repeats from last N completed exams`).
- If the unseen pool is too small for your requested exam size, the simulator falls back to the full unique pool.

## Regression checks

Run the lightweight regression checks from the repository root:

```bash
python3 scripts/regression-checks.py
```

Run repeat-window edge-case self-tests:

```bash
node scripts/repeat-window-selftest.js
```

The script validates:

- question-bank duplicate handling assumptions
- weighted domain target distribution sums
- repeat-avoidance fallback behavior

## Run locally

If you want to launch the app locally without configuring GitHub Pages, use one of the startup scripts from the repository root:

```bash
./scripts/start-exam.sh
```

On Windows PowerShell:

```powershell
.\scripts\start-exam.ps1
```

Both scripts start a simple local HTTP server and open `http://127.0.0.1:8000/docs/`. You can optionally pass a different port as the first argument.

## Regenerate `questions.json`

Whenever the raw practice question markdown changes, rebuild the bundled question bank from the repository root:

```bash
node scripts/build-questions.js
```

That script parses the three raw practice test files in `source/docs/practice/raw/` and rewrites `docs/questions.json`.
