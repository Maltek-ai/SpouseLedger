// node --test: proves check:spec passes on the real spec and fails on each broken copy.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkSpec, sectionRefs, updateLock } from "../scripts/spec-lib.mjs";

const spec = JSON.parse(readFileSync("spec/ledger-spec.json", "utf8"));
const lock = JSON.parse(readFileSync("spec/keys.lock.json", "utf8"));
const changelog = readFileSync("spec/CHANGELOG.md", "utf8");
const copy = () => structuredClone(spec);
const section = (s, id) => s.sections.find((x) => x.id === id);
const block = (s, id, key) => section(s, id).blocks.find((b) => b.key === key);

test("the real spec passes", () => {
  assert.deepEqual(checkSpec(spec, lock, changelog), []);
});

test("v2.1.0 has 113 keyed fields across 15 sections", () => {
  assert.equal(spec.sections.length, 15);
  assert.equal(spec.sections.flatMap((s) => s.blocks.filter((b) => b.key)).length, 113);
});

test("removing a block key fails", () => {
  const s = copy();
  const blocks = section(s, "taxes").blocks;
  blocks.splice(blocks.findIndex((b) => b.key === "property_taxes"), 1);
  const errs = checkSpec(s, lock);
  assert.ok(errs.some((e) => e.includes('"taxes:property_taxes"')), errs.join("\n"));
});

test("renaming a column key fails", () => {
  const s = copy();
  block(s, "business-money", "business_bank_accounts").columns[0].key = "bank_name";
  assert.ok(checkSpec(s, lock).some((e) => e.includes("business_bank_accounts/col:bank")));
});

test("removing a section fails", () => {
  const s = copy();
  s.sections = s.sections.filter((x) => x.id !== "taxes");
  assert.ok(checkSpec(s, lock).some((e) => e.includes('section id "taxes"')));
});

test("deprecating instead of deleting passes the key check", () => {
  const s = copy();
  block(s, "taxes", "property_taxes").deprecated = true;
  assert.ok(!checkSpec(s, lock).some((e) => e.includes("property_taxes")));
});

test("duplicate keys within a section fail", () => {
  const s = copy();
  block(s, "taxes", "property_taxes").key = "tax_preparer_cpa";
  assert.ok(checkSpec(s).some((e) => e.includes('duplicate block key "tax_preparer_cpa"')));
});

test("unknown block type fails", () => {
  const s = copy();
  section(s, "taxes").blocks.push({ type: "slider", key: "x", label: "x" });
  assert.ok(checkSpec(s).some((e) => e.includes('unknown block type "slider"')));
});

test("missing disclaimer ref fails", () => {
  const s = copy();
  delete s.disclaimers.tax;
  assert.ok(checkSpec(s).some((e) => e.includes('disclaimer ref "tax"')));
});

test("cross-reference to a missing section fails", () => {
  const s = copy();
  block(s, "taxes", "property_taxes").helper = "See Sections 6 and 21";
  assert.ok(checkSpec(s).some((e) => e.includes("Section 21")));
});

test("rowLabels outnumbering rows fails", () => {
  const s = copy();
  block(s, "insurance", "policies").rows = 3;
  assert.ok(checkSpec(s).some((e) => e.includes("rowLabels but only 3 rows")));
});

test("changing the spec without bumping specVersion fails", () => {
  const s = copy();
  block(s, "taxes", "property_taxes").label = "Property Tax";
  assert.ok(checkSpec(s, lock).some((e) => e.includes("bump it")));
});

test("bumping the version without a CHANGELOG entry fails", () => {
  const s = copy();
  s.specVersion = "2.1.1";
  assert.ok(checkSpec(s, lock, changelog).some((e) => e.includes('no "## 2.1.1" entry')));
});

test("a label change with bump, changelog and re-lock passes", () => {
  const s = copy();
  s.specVersion = "2.2.0";
  block(s, "taxes", "property_taxes").label = "Property Tax";
  const log = changelog + "\n## 2.2.0 (2026-10-13)\n- Sections: taxes\n";
  assert.deepEqual(checkSpec(s, updateLock(s, lock), log), []);
});

test("re-locking never drops a previously locked key", () => {
  const s = copy();
  section(s, "taxes").blocks = section(s, "taxes").blocks.filter((b) => b.key !== "property_taxes");
  assert.ok(updateLock(s, lock).sections.taxes.includes("property_taxes"));
});

test("section reference parsing", () => {
  assert.deepEqual(sectionRefs("Turn to **Section 14 (First 30 Days)**"), [14]);
  assert.deepEqual(sectionRefs("(**Sections 2 and 6**)").sort(), [2, 6]);
  assert.deepEqual(sectionRefs("(Sections 1-5)").sort((a, b) => a - b), [1, 5]);
});

test("the CLI exits non-zero on a test copy with a key removed", () => {
  const dir = mkdtempSync(join(tmpdir(), "spec-"));
  cpSync("spec", dir, { recursive: true });
  const s = copy();
  section(s, "first-30-days").blocks = section(s, "first-30-days").blocks.filter((b) => b.key !== "anything_else");
  writeFileSync(join(dir, "ledger-spec.json"), JSON.stringify(s));
  assert.throws(
    () => execFileSync("node", ["scripts/check-spec.mjs", join(dir, "ledger-spec.json")], { stdio: "pipe" }),
    (e) => e.status === 1 && String(e.stderr).includes("first-30-days:anything_else"),
  );
});
