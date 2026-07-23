# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single static **Next.js 14** personal blog (App Router, `output: 'export'`) using `contentlayer` for MDX posts (`data/blog`, `posts/`), Tailwind, and Framer Motion. There is no backend/database and no test suite.

### Package manager / Node
- Use **pnpm 9.6.0** (matches CI in `.github/workflows/sync-post.yml`). It is activated via corepack; invoke as `corepack pnpm ...`. The system default `pnpm` is v10, which blocks build scripts (e.g. `sharp`) behind an interactive prompt, so prefer the corepack `pnpm@9.6.0`.
- Node 20 or 22 both work (default VM node is 22).

### Required env vars (non-obvious)
- `env.mjs` runs Zod validation at build/dev startup and **throws** if `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SITE_EMAIL_FROM` are missing. A local `.env` with dev placeholders is required, and it is **git-ignored** (never committed), so it must exist locally. The startup update script recreates it if absent. You can bypass validation with `SKIP_ENV_VALIDATION=1`, but the two `NEXT_PUBLIC_` values are still consumed by the app, so setting them is preferred.

### Commands (see `package.json` scripts)
- Dev server: `corepack pnpm dev` (http://localhost:3000).
- Build (static export to `out/`): `corepack pnpm build`.
- Lint: `corepack pnpm lint` — note this script runs `eslint --fix` and **mutates files**. To only check without changing files, run `corepack pnpm exec eslint --ext .ts,.js,.jsx,.tsx .`.
- `next build` triggers RSS generation (`scripts/generate-rss.js`) via `next.config.mjs`.

### Git hooks
- Husky runs `lint-staged` (eslint --fix + prettier) on commit and `commitlint` (conventional commits) on commit messages, so commit messages must follow the conventional format (e.g. `feat: ...`, `chore: ...`).
