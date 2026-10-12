// Shared logic for `npm run check:spec` and `npm run spec:lock`.
// Plain Node (no dependencies) so it can run in CI, pre-commit and pre-build.
import { createHash } from "node:crypto";

export const BLOCK_TYPES = new Set([
  "text",
  "table",
  "contacts",
  "checklist",
  "disclaimer",
  "info",
  "heading",
  "subsection",
  "pagebreak",
]);
export const KEYED_TYPES = new Set(["text", "table", "contacts", "checklist"]);
const SHARING = new Set(["now", "on_unlock"]);
const SEMVER = /^\d+\.\d+\.\d+$/;

/** Hash of the spec's canonical JSON, so formatting-only edits don't count as changes. */
export function specHash(spec) {
  return createHash("sha256").update(JSON.stringify(spec)).digest("hex");
}

/**
 * Every permanent key in the spec, grouped by section id.
 * Sub-keys are namespaced by their block: `block/col:x`, `block/role:x`,
 * `block/field:x`, `block/item:x`.
 */
export function collectKeys(spec) {
  const out = { _meta: (spec.meta?.coverFields ?? []).map((f) => `cover:${f.key}`) };
  for (const s of spec.sections ?? []) {
    const keys = [];
    for (const b of s.blocks ?? []) {
      if (!b.key) continue;
      keys.push(b.key);
      for (const c of b.columns ?? []) keys.push(`${b.key}/col:${c.key}`);
      for (const r of b.roles ?? []) keys.push(`${b.key}/role:${r.key}`);
      for (const f of b.fields ?? []) keys.push(`${b.key}/field:${f}`);
      for (const i of b.items ?? []) keys.push(`${b.key}/item:${i.key}`);
    }
    out[s.id] = keys;
  }
  return out;
}

function dupes(list) {
  const seen = new Set();
  const d = new Set();
  for (const x of list) (seen.has(x) ? d : seen).add(x);
  return [...d];
}

/** Every string in the spec, with a path for error messages. */
function* strings(node, path = "") {
  if (typeof node === "string") yield [path, node];
  else if (Array.isArray(node)) for (let i = 0; i < node.length; i++) yield* strings(node[i], `${path}[${i}]`);
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) yield* strings(v, path ? `${path}.${k}` : k);
}

/**
 * "Section 14", "Sections 2 and 6", "Sections 1-5", "Sections 1, 4 and 12"
 * -> the section numbers referenced.
 */
export function sectionRefs(text) {
  const nums = [];
  const re = /\bSections?\s+(\d+(?:\s*(?:-|–|,|and|&)\s*\d+)*)/g;
  for (const m of text.matchAll(re)) {
    const run = m[1];
    for (const r of run.matchAll(/(\d+)\s*[-–]\s*(\d+)/g)) nums.push(+r[1], +r[2]);
    for (const n of run.replace(/(\d+)\s*[-–]\s*(\d+)/g, "").matchAll(/\d+/g)) nums.push(+n[0]);
  }
  return nums;
}

/**
 * Validate a spec (and optionally its lock file and changelog text).
 * Returns a list of human-readable errors; empty means OK.
 */
export function checkSpec(spec, lock = null, changelog = null) {
  const errors = [];
  const err = (m) => errors.push(m);

  if (!SEMVER.test(spec.specVersion ?? "")) err(`specVersion "${spec.specVersion}" is not semver (x.y.z)`);
  if (typeof spec.legalReviewStatus !== "string") err("legalReviewStatus is missing");
  const disclaimers = spec.disclaimers ?? {};
  if (!disclaimers.full) err('disclaimers.full is missing (required for first-login acceptance)');
  const parts = new Set((spec.parts ?? []).map((p) => p.id));

  const sections = spec.sections ?? [];
  const numbers = new Set(sections.map((s) => s.number));
  for (const id of dupes(sections.map((s) => s.id))) err(`duplicate section id "${id}"`);
  for (const n of dupes(sections.map((s) => s.number))) err(`duplicate section number ${n}`);
  for (let n = 0; n < sections.length; n++) if (!numbers.has(n)) err(`section numbers must run 0..${sections.length - 1}; ${n} is missing`);

  for (const s of sections) {
    const where = `section "${s.id}"`;
    if (!s.id) err(`section number ${s.number} has no id`);
    if (!parts.has(s.part)) err(`${where}: unknown part "${s.part}"`);
    if (!s.title || !s.shortTitle) err(`${where}: title and shortTitle are required`);
    if (s.sharing && !SHARING.has(s.sharing)) err(`${where}: sharing must be now or on_unlock`);

    const blockKeys = [];
    (s.blocks ?? []).forEach((b, i) => {
      const at = `${where} block ${i}${b.key ? ` ("${b.key}")` : ""}`;
      if (!BLOCK_TYPES.has(b.type)) return err(`${at}: unknown block type "${b.type}"`);
      if (b.sharing && !SHARING.has(b.sharing)) err(`${at}: sharing must be now or on_unlock`);
      if (KEYED_TYPES.has(b.type)) {
        if (!b.key) err(`${at}: ${b.type} block needs a key`);
        else blockKeys.push(b.key);
        if (!b.label) err(`${at}: label is required`);
      }
      if (b.type === "disclaimer" && !disclaimers[b.ref]) err(`${at}: disclaimer ref "${b.ref}" not found in disclaimers`);
      if (b.type === "table") {
        const cols = b.columns ?? [];
        if (!cols.length) err(`${at}: table has no columns`);
        if (cols.some((c) => !c.key)) err(`${at}: every column needs a key`);
        for (const k of dupes(cols.map((c) => c.key))) err(`${at}: duplicate column key "${k}"`);
        if (!Number.isInteger(b.rows) || b.rows < 1) err(`${at}: rows must be a positive integer`);
        if (b.rowLabels && b.rowLabels.length > b.rows) err(`${at}: ${b.rowLabels.length} rowLabels but only ${b.rows} rows`);
      }
      if (b.type === "contacts") {
        const roles = b.roles ?? [];
        if (roles.some((r) => !r.key)) err(`${at}: every role needs a key`);
        for (const k of dupes(roles.map((r) => r.key))) err(`${at}: duplicate role key "${k}"`);
      }
      if (b.type === "checklist") {
        const items = b.items ?? [];
        if (!items.length) err(`${at}: checklist has no items`);
        if (items.some((it) => !it.key)) err(`${at}: every item needs a key`);
        for (const k of dupes(items.map((it) => it.key))) err(`${at}: duplicate item key "${k}"`);
      }
    });
    for (const k of dupes(blockKeys)) err(`${where}: duplicate block key "${k}"`);
  }

  for (const [path, text] of strings(spec)) {
    for (const n of sectionRefs(text)) if (!numbers.has(n)) err(`${path}: refers to Section ${n}, which does not exist`);
  }

  if (lock) {
    const current = collectKeys(spec);
    for (const [sectionId, keys] of Object.entries(lock.sections ?? {})) {
      if (!current[sectionId]) {
        err(`section id "${sectionId}" is in keys.lock.json but missing from the spec (keys are permanent; deprecate instead)`);
        continue;
      }
      const have = new Set(current[sectionId]);
      for (const k of keys) if (!have.has(k)) err(`key "${sectionId}:${k}" is in keys.lock.json but missing from the spec (keys are permanent; deprecate instead)`);
    }
    const lockedV = lock.specVersion ?? "0.0.0";
    if (cmpSemver(spec.specVersion, lockedV) < 0) err(`specVersion ${spec.specVersion} is older than the locked ${lockedV}`);
    if (lock.specSha256 && lock.specSha256 !== specHash(spec)) {
      if (spec.specVersion === lockedV)
        err(`the spec changed but specVersion is still ${lockedV}: bump it, add a CHANGELOG.md entry, then run npm run spec:lock`);
      else err(`specVersion is now ${spec.specVersion}: run npm run spec:lock to record the new keys`);
    }
  }

  if (changelog !== null && !new RegExp(`^##\\s+${escapeRe(spec.specVersion)}\\b`, "m").test(changelog))
    err(`spec/CHANGELOG.md has no "## ${spec.specVersion}" entry`);

  return errors;
}

export function cmpSemver(a = "0.0.0", b = "0.0.0") {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

const escapeRe = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Merge the current spec's keys into the lock. Never drops a key that was already locked. */
export function updateLock(spec, lock) {
  const sections = structuredClone(lock?.sections ?? {});
  for (const [id, keys] of Object.entries(collectKeys(spec))) {
    const merged = sections[id] ?? [];
    for (const k of keys) if (!merged.includes(k)) merged.push(k);
    sections[id] = merged;
  }
  return {
    _comment: "Every key ever shipped. Generated by `npm run spec:lock`; never delete entries by hand.",
    specVersion: spec.specVersion,
    specSha256: specHash(spec),
    sections,
  };
}
