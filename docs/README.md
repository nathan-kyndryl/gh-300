# Practice Exam Simulator

The static practice exam app in this folder is designed for GitHub Pages hosting and reads its question bank from `questions.json`.

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
