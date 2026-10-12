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

## 2.1.1 (2026-10-12)
- Sections: household-money
- Personal Bank Accounts: "In whose name?" column now reads "joint / mine / theirs" instead of "hers", so it doesn't assume the spouse's gender. Label change only; the field's key is unchanged.
