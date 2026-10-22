// The pure part of the badge system: no DOM and no imports, so it runs in the browser and in Node tests.
// js/badges.js (the screens) imports everything from here and re-exports it.
//
// A badge FAMILY is one tile in the profile grid; it has an ordered ladder of TIERS. A tier is earned when
// snapshot[family.metric] >= tier.at. The snapshot is a plain object of numbers that js/main.js builds.

export const SNAPSHOT_KEYS = [
  "level", "xp", "streak", "gamesPlayed", "correctAnswers", "sprintBeats", "sprintBest", "shares",
  "challengesSent", "challengesWon", "reviews", "quizBest", "cardsReviewed", "decksFinished", "glossaryStudied",
  "comebacks", "topicsTamed", "classesConquered", "nightSessions", "earlySessions", "examPrepped",
];

// Motivational lines. {remaining} {unit} {next} {how} {name} {rank} are filled in. A family can bring its own "cheer" list.
export const DEFAULT_CHEER = [
  "{remaining} more {unit} to unlock {next}. You've got this!",
  "Only {remaining} {unit} to go until {next}. Keep going!",
  "So close! {remaining} more {unit} for {next}.",
  "{remaining} {unit} away from {next}. You can do it!",
];
// used while nothing has been earned and nothing has been done yet
export const WAKE_CHEER = ["{how} to wake this one up", "{how} and this badge lights up"];
// used when every tier of the family is earned
export const DONE_CHEER = ["Every {name} tier is unlocked. Take a bow!", "Top of the ladder. Nothing left to unlock here!", "Maxed out. You have unlocked every tier!"];

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);
const isStr = (v) => typeof v === "string" && v.trim() !== "";

// a stable pick, so the line does not flicker every time the screen redraws
function hash(s) {
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0;
  return x;
}
const pickStable = (list, seed) => list[hash(seed) % list.length];

export const formatCount = (n) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10).toLocaleString("en-US");

// "days" -> "day", "classes" -> "class", "percentage points" -> "percentage point", "XP" stays "XP"
export function singular(unit) {
  const u = String(unit || "");
  if (/(sses|xes|ches|shes)$/.test(u)) return u.slice(0, -2);
  if (u.endsWith("s") && !u.endsWith("ss")) return u.slice(0, -1);
  return u;
}
// the unit word for a count: one day, two days
export function unitLabel(family, n) {
  const u = family && family.unit ? String(family.unit) : "";
  if (n === 1) return family && family.unitSingular ? String(family.unitSingular) : singular(u);
  return u;
}

function fill(template, vars) {
  return String(template).replace(/[{]([a-zA-Z]+)[}]/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
// the "how" line without a trailing example in brackets, so it can sit inside a longer sentence
const shortHow = (how) => String(how || "").replace(/ *[(][^)]*[)] *$/, "");

function cheerFor(f) {
  const pool = Array.isArray(f.cheerList) && f.cheerList.length ? f.cheerList.filter(isStr) : DEFAULT_CHEER;
  const seed = f.id + ":" + f.value + ":" + f.earnedCount;
  if (!f.next) return fill(pickStable(DONE_CHEER, seed), { name: f.name });
  const vars = { remaining: formatCount(f.remaining), unit: unitLabel(f, f.remaining), next: f.next.name, how: shortHow(f.next.how), name: f.name, rank: f.next.rank };
  if (f.earnedCount === 0 && f.value === 0) return fill(pickStable(WAKE_CHEER, seed), vars);
  return fill(pickStable(pool.length ? pool : DEFAULT_CHEER, seed), vars);
}

// ---------- evaluation ----------
// snap:  numbers by metric key (a missing key counts as 0)
// saved: { [familyId]: how many tiers are already earned and stored } or undefined
// Returns every family with its state, the tiers that are newly earned (fresh) and the updated saved map.
// The saved map NEVER decreases: a badge stays earned even if the metric later drops (or the family is removed from the config).
export function evaluateBadges(config, snap, saved) {
  const s = snap && typeof snap === "object" ? snap : {};
  const prev = saved && typeof saved === "object" ? saved : {};
  const level = num(s.level);
  const nextSaved = {};
  for (const k of Object.keys(prev)) { const n = Math.floor(num(prev[k])); if (n > 0) nextSaved[k] = n; }
  const families = [], fresh = [];
  const list = config && Array.isArray(config.families) ? config.families : [];
  for (const f of list) {
    if (!f || typeof f !== "object" || typeof f.id !== "string" || !Array.isArray(f.tiers)) continue;
    const raw = f.tiers.filter((t) => t && typeof t === "object" && typeof t.at === "number" && Number.isFinite(t.at));
    if (!raw.length) continue;
    const value = num(s[f.metric]);
    let hit = 0; // the run of tiers from the bottom whose threshold is met right now
    while (hit < raw.length && value >= raw[hit].at) hit++;
    const was = Math.min(raw.length, nextSaved[f.id] || 0);
    const earnedCount = Math.max(hit, was);
    const tiers = raw.map((t, i) => ({ index: i, name: String(t.name || ""), rank: String(t.rank || ""), at: t.at, image: String(t.image || ""), how: String(t.how || ""), earned: i < earnedCount }));
    const minLevel = Number.isFinite(f.minLevel) ? f.minLevel : 1;
    const next = tiers[earnedCount] || null;
    const fam = {
      id: f.id, name: String(f.name || f.id), metric: f.metric, unit: String(f.unit || ""), unitSingular: f.unitSingular ? String(f.unitSingular) : "",
      suffix: f.suffix ? String(f.suffix) : "", minLevel, value, cheerList: Array.isArray(f.cheer) ? f.cheer : null,
      visible: minLevel <= 1 || level >= minLevel || earnedCount > 0,
      tiers, earnedCount, current: tiers[earnedCount - 1] || null, next,
      remaining: next ? Math.max(0, Math.ceil(next.at - value)) : null,
      progress: next ? Math.min(1, value / next.at) : 1,
      cheer: "",
    };
    fam.cheer = cheerFor(fam);
    for (let i = was; i < hit; i++) fresh.push({ family: fam, tier: tiers[i] });
    if (earnedCount > (nextSaved[f.id] || 0)) nextSaved[f.id] = earnedCount; // zero entries are not stored, so the map stays small
    families.push(fam);
  }
  return { families, fresh, saved: nextSaved };
}

// ---------- text helpers shared by the screens and the tests ----------
export const tierImageAlt = (family, tier) => `${tier.name} badge${tier.rank ? ", " + tier.rank + " rank" : ""}`;

// "4 more days"
export const moreText = (f) => (f.next ? `${formatCount(f.remaining)} more ${unitLabel(f, f.remaining)}` : "");
// the tier a tile shows: the highest earned one, or the first one while nothing is earned
export const shownTier = (f) => f.current || f.tiers[0];
// "3 / 7" (or "72% / 90%"), or "Complete"
export function progressText(f) {
  if (!f.next) return "Complete";
  const sx = f.suffix || "";
  return `${formatCount(Math.min(f.value, f.next.at))}${sx} / ${formatCount(f.next.at)}${sx}`;
}
// what a screen reader says for a tile
export function tileAriaLabel(f) {
  const t = shownTier(f);
  if (!f.current) return `${t.name}, locked. ${t.how}`;
  return `${t.name}, ${t.rank} rank, earned. ` + (f.next ? `Next: ${f.next.name}, ${moreText(f)}` : "Every tier unlocked");
}
// "Next: On Fire, 4 more days" for the celebration. tier = the tier just earned.
export function nextGoalText(f, tier) {
  const nx = f.tiers[tier.index + 1];
  if (!nx) return "That is every tier of this badge. Legendary!";
  if (nx.earned) return `Next: ${nx.name}, and you have already earned it too!`;
  const left = Math.max(0, Math.ceil(nx.at - f.value));
  return `Next: ${nx.name}, ${formatCount(left)} more ${unitLabel(f, left)}`;
}
// "7 of 52 earned" (counts every tier in the config)
export function badgeTotals(model) {
  let earned = 0, total = 0, visible = 0;
  for (const f of (model && model.families) || []) { earned += f.earnedCount; total += f.tiers.length; if (f.visible) visible++; }
  return { earned, total, visible };
}
// the first letters of a name for the placeholder circle: "Speed of Light" -> "SL"
// (one word: its first two letters, "Unstoppable" -> "UN")
export function initials(name) {
  const all = String(name || "").split(" ").filter(Boolean);
  const words = all.filter((w) => /^[A-Z0-9]/.test(w));
  const use = words.length ? words : all;
  const s = use.length === 1 ? use[0].slice(0, 2) : use.slice(0, 2).map((w) => w.charAt(0)).join("");
  return (s || "?").toUpperCase();
}

// ---------- config check (used by the Node test; also handy in the console) ----------
// Returns a list of problems (empty = fine). File checks (do the images exist) live in tools/test_badges.mjs.
export function validateBadgeConfig(config, keys = SNAPSHOT_KEYS) {
  const bad = [];
  if (!config || typeof config !== "object") return ["config is not an object"];
  if (config.version !== 1) bad.push("version must be 1");
  if (!Array.isArray(config.families) || !config.families.length) return bad.concat("families must be a non-empty list");
  const ids = new Set(), names = new Set();
  config.families.forEach((f, fi) => {
    const where = `family #${fi + 1}${f && f.id ? ` (${f.id})` : ""}`;
    if (!f || typeof f !== "object") { bad.push(where + ": not an object"); return; }
    if (!isStr(f.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id)) bad.push(where + ": id must be lowercase letters, digits and hyphens");
    else if (ids.has(f.id)) bad.push(where + ": duplicate family id");
    else ids.add(f.id);
    if (!isStr(f.name)) bad.push(where + ": name is missing");
    if (!isStr(f.metric)) bad.push(where + ": metric is missing");
    else if (!keys.includes(f.metric)) bad.push(`${where}: unknown metric "${f.metric}" (valid: ${keys.join(", ")})`);
    if (!isStr(f.unit)) bad.push(where + ": unit is missing");
    if (!Number.isInteger(f.minLevel) || f.minLevel < 1) bad.push(where + ": minLevel must be a whole number, 1 or more");
    if (f.ladder != null && !isStr(f.ladder)) bad.push(where + ": ladder must be text");
    if (f.suffix != null && typeof f.suffix !== "string") bad.push(where + ": suffix must be text");
    if (f.cheer != null) {
      if (!Array.isArray(f.cheer) || !f.cheer.length || !f.cheer.every(isStr)) bad.push(where + ": cheer must be a list of phrases");
      else for (const c of f.cheer) for (const m of c.match(/[{][^}]*[}]/g) || []) if (!["{remaining}", "{unit}", "{next}", "{how}", "{name}", "{rank}"].includes(m)) bad.push(`${where}: unknown placeholder ${m} in cheer`);
    }
    if (!Array.isArray(f.tiers) || !f.tiers.length) { bad.push(where + ": needs at least one tier"); return; }
    let last = -Infinity;
    f.tiers.forEach((t, ti) => {
      const tw = `${where}, tier ${ti + 1}${t && t.name ? ` (${t.name})` : ""}`;
      if (!t || typeof t !== "object") { bad.push(tw + ": not an object"); return; }
      if (!isStr(t.name)) bad.push(tw + ": name is missing");
      else if (names.has(t.name.toLowerCase())) bad.push(tw + ": duplicate tier name");
      else names.add(t.name.toLowerCase());
      if (!isStr(t.rank)) bad.push(tw + ": rank is missing");
      if (!isStr(t.how)) bad.push(tw + ": how is missing");
      if (typeof t.at !== "number" || !Number.isFinite(t.at) || t.at <= 0) bad.push(tw + ": at must be a number above 0");
      else { if (t.at <= last) bad.push(tw + `: at (${t.at}) must be bigger than the tier before it (${last})`); last = t.at; }
      if (!isStr(t.image) || !t.image.endsWith(".png")) bad.push(tw + ": image must be a .png path");
    });
  });
  return bad;
}
