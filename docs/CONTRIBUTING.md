# Contributing and GitHub Attribution

GitHub attributes commits to the author email embedded in each commit. For this repository, contributors should configure Git with an email address verified on their GitHub account before creating commits:

```bash
git config user.name "Your GitHub name"
git config user.email "your-verified-email@example.com"
```

The repository is public and uses `main` as its default branch. Commits should be pushed to `main` or merged into `main` for the contribution graph to include them. GitHub may take a short period to refresh the graph after a push. Existing commits authored with an email that is not associated with the account will not be retroactively attributed unless history is deliberately rewritten, so this project does not rewrite its published history automatically.

Every implementation phase should be committed separately with a descriptive message and verified with tests, lint, build, and `git diff --check` before pushing.
