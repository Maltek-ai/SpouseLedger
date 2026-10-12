# Spec changelog

Every change to `ledger-spec.json` bumps `specVersion` and adds an entry here.
Each entry lists the section ids that changed, so owners know which pages of a
printed book are out of date. `npm run check:spec` fails if the current version
has no entry.

Format:

```
## x.y.z (YYYY-MM-DD)
- Sections: section-id, section-id
- What changed, in a sentence or two.
```

## 2.1.0 (2026-10-12)
- Sections: (baseline; all sections)
- First version tracked in this repo. Matches the v2.1.0 printed worksheet.
