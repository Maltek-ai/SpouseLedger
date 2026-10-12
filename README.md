# Spouse Ledger

A web app for self-employed and small-business owners to record everything their
spouse would need to keep the business and the household running, or wind them
down safely, if something happens to the owner.

> **Status: proof of concept, invite-only beta.** It has no SOC 2 or similar
> certification. The legal notices are still waiting on attorney review.

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, Supabase (Postgres, auth, RLS),
deployed on Vercel. Production domain: spouseledger.com.

## Running locally

```bash
npm ci
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

`GET /api/health` returns `{ ok, commit, env }`. Use it to check which commit
is deployed.

## Environment variables

See `.env.example` for the full list, each with a comment.

## Deploying (Vercel)

1. In Vercel, **Add New → Project**, import `maltek-ai/spouseledger`. The
   framework preset (Next.js) and default build settings work as is.
2. Add the environment variables from `.env.example` (they can stay empty
   until auth lands).
3. After it's live, add `spouseledger.com` under **Settings → Domains**.

Every push to `main` deploys production. Every other branch gets a preview URL.

## The spec

Ledger content (sections, fields, checklists, disclaimers) comes from
`spec/ledger-spec.json`, the same file that generates the printable
worksheet (`scripts/build_worksheet_from_spec.py`). Never hardcode ledger
text in components. The rules for changing the spec safely will be written
here when `npm run check:spec` lands.

`docs/content-structure-v2.1.0.md` is a generated outline of spec v2.1.0, kept
for reference only.

## Shortcuts taken for time

Tracked here so they're easy to harden later.

- (none yet)
