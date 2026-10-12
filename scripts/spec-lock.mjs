#!/usr/bin/env node
// npm run spec:lock
// Records the current spec's keys and hash in spec/keys.lock.json. Run it after
// bumping specVersion and adding a CHANGELOG.md entry. Never removes locked keys.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cmpSemver, specHash, updateLock } from "./spec-lib.mjs";

const specPath = "spec/ledger-spec.json";
const lockPath = "spec/keys.lock.json";
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : null;

if (lock?.specSha256 === specHash(spec)) {
  console.log(`${lockPath} is already up to date for v${spec.specVersion}`);
  process.exit(0);
}
if (lock && cmpSemver(spec.specVersion, lock.specVersion) <= 0 && lock.specSha256) {
  console.error(`specVersion is still ${spec.specVersion}. Bump it (and add a CHANGELOG.md entry) before re-locking.`);
  process.exit(1);
}
writeFileSync(lockPath, JSON.stringify(updateLock(spec, lock), null, 2) + "\n");
console.log(`wrote ${lockPath} for v${spec.specVersion}`);
