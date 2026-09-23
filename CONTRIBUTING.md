# Contributing

## Workflow

1. Create a branch from `main`:
   `git checkout -b <type>/<short-description>` — e.g. `feat/bundle-discounts`,
   `fix/checkout-permalink`, `chore/update-deps`.
2. Open a pull request using the provided template. Fill in every section.
3. CI (`npm run build`) and Vercel preview must pass before merge.
4. Squash-merge into `main` after approval. Delete the branch after merge.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(agent): add room-fit clearance tool
fix(api): correct variant availability mapping
chore(deps): bump next to 15.2
```

## Rules

- **No secrets in the repository.** Shopify tokens and env vars stay in `.env`
  (gitignored) — see `SECURITY.md`.
- Don't commit build artifacts (`deploy.tar.gz`, `.next/`, logs).
- Test scripts live in `tests/` — run them against staging only.
