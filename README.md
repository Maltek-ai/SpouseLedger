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

## The spec is the product

`spec/ledger-spec.json` defines every section, field, checklist and disclaimer.
The app and the printable worksheet are both generated from it, so they can't
drift apart. Never hardcode ledger text in a component.

| Command | What it does |
|---|---|
| `npm run check:spec` | Validates the spec (also runs before every build, on pre-commit, and in CI) |
| `npm run spec:lock` | Records the spec's keys and hash in `spec/keys.lock.json` |
| `npm run build:worksheet` | Regenerates `public/worksheet/spouse-ledger-worksheet.pdf` (needs `pip install -r scripts/requirements.txt`) |
| `npm test` | Spec checker tests, including "removing a key fails" |

### Changing the spec safely

1. **Edit labels, helper text, disclaimers and order freely.**
2. **Never rename or delete a key.** That includes section ids and block, column,
   role, contacts field and checklist item keys. To retire a field, add
   `"deprecated": true`. The app will show it read-only if it holds data and
   hide it if it's empty.
3. **Bump `specVersion`** (semver), and add a `## x.y.z (date)` entry to
   `spec/CHANGELOG.md` listing the section ids that changed.
4. Run `npm run spec:lock`. It adds new keys and never removes old ones.
5. Run `npm run build:worksheet` and commit the PDF with the spec.
6. Run `npm run check:spec`. It fails if:
   - a locked key is missing
   - keys are duplicated within a section
   - a block type is unknown
   - a `disclaimer.ref` is missing
   - a "Section N" reference points nowhere
   - `rowLabels` outnumber `rows`
   - the spec changed without a version bump or changelog entry
   - the committed PDF wasn't regenerated from this exact spec (the build
     script stamps the spec's SHA-256 into the PDF's metadata)

Publishing a GitHub release attaches the worksheet PDF for that spec version
automatically (`.github/workflows/release.yml`).


## Shortcuts taken for time

Tracked here so they're easy to harden later.

- The pre-commit hook checks the working tree, not the staged files, so a
  partially staged spec change could slip through locally. CI still catches it.
