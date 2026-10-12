#!/usr/bin/env node
// npm run check:spec [-- path/to/spec.json]
// Fails (exit 1) if the spec breaks a sync rule. See README "Changing the spec safely".
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { checkSpec, collectKeys } from "./spec-lib.mjs";

const specPath = process.argv[2] ?? "spec/ledger-spec.json";
const dir = dirname(specPath);
const lockPath = join(dir, "keys.lock.json");
const changelogPath = join(dir, "CHANGELOG.md");

const spec = JSON.parse(readFileSync(specPath, "utf8"));
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : null;
const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : null;

const errors = checkSpec(spec, lock, changelog);
if (!lock) errors.push(`${lockPath} not found: run npm run spec:lock`);
if (changelog === null) errors.push(`${changelogPath} not found`);

// The committed worksheet must be generated from this exact spec file.
// Only checked for the real spec (test copies pass their own path).
const pdfPath = "public/worksheet/spouse-ledger-worksheet.pdf";
if (process.argv[2] === undefined) {
  const want = "ledger-spec sha256:" + createHash("sha256").update(readFileSync(specPath)).digest("hex");
  const pdf = existsSync(pdfPath) ? readFileSync(pdfPath, "latin1") : "";
  if (!pdf.includes(want)) errors.push(`${pdfPath} is missing or out of date: run npm run build:worksheet and commit it`);
}

if (errors.length) {
  console.error(`check:spec FAILED for ${specPath} (v${spec.specVersion}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const keyed = spec.sections.reduce((n, s) => n + s.blocks.filter((b) => b.key).length, 0);
const all = Object.values(collectKeys(spec)).flat().length;
console.log(`check:spec OK: v${spec.specVersion}, ${spec.sections.length} sections, ${keyed} keyed fields, ${all} locked keys`);
