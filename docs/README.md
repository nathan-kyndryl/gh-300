# Practice Exam Simulator

The static practice exam app in this folder is designed for GitHub Pages hosting and reads its question bank from `questions.json`.

## Regenerate `questions.json`

Whenever the raw practice question markdown changes, rebuild the bundled question bank from the repository root:

```bash
node scripts/build-questions.js
```

That script parses the three raw practice test files in `source/docs/practice/raw/` and rewrites `docs/questions.json`.
