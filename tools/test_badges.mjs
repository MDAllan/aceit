// Tests for the badge system: the config (badges/badges.json + the pictures) and the pure logic in js/badges-core.js.
// Run: node tools/test_badges.mjs     (exits with a non-zero code on any failure)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SNAPSHOT_KEYS, evaluateBadges, validateBadgeConfig, tierImageAlt, tileAriaLabel, progressText, nextGoalText, badgeTotals,
  initials, singular, formatCount, DEFAULT_CHEER, WAKE_CHEER, DONE_CHEER,
} from "../js/badges-core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.error("FAIL:", msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

let config;
try { config = JSON.parse(readFileSync(path.join(ROOT, "badges", "badges.json"), "utf8")); }
catch (e) { console.error("FAIL: badges/badges.json cannot be read as JSON (look for a missing comma, a missing quote or an extra comma at the end of a list): " + e.message); process.exit(1); }
if (!config || !Array.isArray(config.families)) { console.error('FAIL: badges/badges.json needs a "families" list'); process.exit(1); }
const fams = config.families;
const byId = (id) => fams.find((f) => f.id === id);
const snapOf = (o) => ({ level: 1, ...o });

/* =========================================================== the config =========================================================== */
const problems = validateBadgeConfig(config);
ok(problems.length === 0, "badges.json has problems:\n  " + problems.join("\n  "));

// an unknown metric is reported
{
  const c = structuredClone(config);
  c.families[0].metric = "gamesPlayd";
  ok(validateBadgeConfig(c).some((p) => p.includes("unknown metric")), "an unknown metric must be reported");
}
// the checker catches the usual mistakes
{
  const mk = (edit) => { const c = structuredClone(config); edit(c); return validateBadgeConfig(c); };
  ok(mk((c) => { c.families[2].tiers[1].at = 3; }).some((p) => p.includes("bigger than")), "tiers must be strictly ascending (equal)");
  ok(mk((c) => { c.families[2].tiers[1].at = 2; }).some((p) => p.includes("bigger than")), "tiers must be strictly ascending (descending)");
  ok(mk((c) => { c.families[1].id = "game-on"; }).some((p) => p.includes("duplicate family id")), "duplicate family ids are reported");
  ok(mk((c) => { c.families[2].tiers[1].name = "hot streak"; }).some((p) => p.includes("duplicate tier name")), "duplicate tier names are reported (any case)");
  ok(mk((c) => { c.families[6].minLevel = 0; }).some((p) => p.includes("minLevel")), "minLevel 0 is reported");
  ok(mk((c) => { c.families[6].minLevel = 2.5; }).some((p) => p.includes("minLevel")), "minLevel must be a whole number");
  ok(mk((c) => { c.families[0].tiers[0].image = "badges/img/x.jpg"; }).some((p) => p.includes(".png")), "a non-PNG image is reported");
  ok(mk((c) => { c.families[2].cheer = ["{oops} days"]; }).some((p) => p.includes("placeholder")), "an unknown cheer placeholder is reported");
  ok(mk((c) => { delete c.families[0].tiers[0].how; }).some((p) => p.includes("how")), "a missing how is reported");
  ok(validateBadgeConfig({}).length > 0 && validateBadgeConfig(null).length > 0, "junk is not a valid config");
}

// the six starters come first, and only they have minLevel 1
eq(fams.slice(0, 6).map((f) => f.id), ["game-on", "correct", "streak", "level", "share", "review"], "starter families, in the owner's order");
ok(fams.filter((f) => f.minLevel === 1).length === 6 && fams.slice(0, 6).every((f) => f.minLevel === 1), "exactly the first six families have minLevel 1");
if (!fams.slice(6).every((f) => f.minLevel >= 2 && f.minLevel <= 8)) console.log("note: some later badges unlock outside levels 2 to 8");
{
  const mins = fams.slice(6).map((f) => f.minLevel);
  if (!mins.every((m, i) => i === 0 || m >= mins[i - 1])) console.log("note: later badges are not listed in the order they unlock (the grid follows the order in the file)");
}

// size of the catalogue
const totalTiers = fams.reduce((n, f) => n + f.tiers.length, 0);
if (totalTiers < 45 || totalTiers > 55) console.log(`note: the catalogue was planned at about 45 to 55 tiers; it has ${totalTiers}`);

// no scientist names; "how" lines never talk about lectures, slides or textbooks
const SCIENTISTS = ["Newton", "Einstein", "Tesla", "Curie", "Faraday", "Franklin", "Darwin", "Galileo", "Hawking", "Kepler", "Pasteur", "Mendel", "Bohr", "Feynman", "Edison", "Copernicus", "Hubble", "Lavoisier", "Mendeleev", "Pythagoras", "Archimedes", "Euclid", "Gauss", "Euler", "Fermat", "Turing", "Lovelace", "Maxwell", "Planck", "Sagan", "Goodall", "Hooke", "Lyell", "Wegener"];
const sciRe = new RegExp("\\b(" + SCIENTISTS.join("|") + ")\\b", "i");
for (const f of fams) {
  ok(!sciRe.test(f.name), `family name "${f.name}" contains a scientist's name`);
  for (const t of f.tiers) {
    ok(!sciRe.test(t.name) && !sciRe.test(t.rank), `tier "${t.name}" / "${t.rank}" contains a scientist's name`);
    ok(!/lectures?|slides?|textbooks?/i.test(t.how + " " + t.name), `how line of "${t.name}" mentions lectures, slides or a textbook: ${t.how}`);
    ok(t.how.trim().length >= 8, `how line of "${t.name}" is too short`);
  }
}

// every family has its own rank ladder (no two families share the same ordered ranks) and the ranks are short labels
{
  const seen = new Map();
  for (const f of fams) {
    const key = f.tiers.map((t) => t.rank).join(">");
    ok(!seen.has(key), `families ${seen.get(key)} and ${f.id} use exactly the same rank ladder (${key})`);
    seen.set(key, f.id);
    ok(f.tiers.every((t) => t.rank.length <= 14), `a rank label in ${f.id} is long (shown on a small tier)`);
  }
}

// the names the owner chose (a note is printed if you changed any of them)
{
  const want = [
    ["game-on", "Game On", 1], ["correct", "Busy Beaver", 10], ["streak", "Hot Streak", 3], ["streak", "On Fire", 7], ["streak", "Unstoppable", 30],
    ["level", "High Five", 5], ["share", "Study Buddy", 1], ["share", "Squad Goals", 5], ["review", "Golden Critic", 1],
    ["sprint", "Flash", 1], ["sprint", "Lightning", 5], ["sprint", "Speed of Light", 15], ["accuracy", "Sharpshooter", 90], ["accuracy", "Bullseye", 100],
    ["cards", "Card Shark", 50], ["decks", "Deck Master", 1], ["words", "Word Nerd", 25], ["comeback", "Comeback Kid", 1], ["tamer", "Topic Tamer", 1],
    ["conquer", "Class Conqueror", 1], ["xp", "Century Club", 100], ["xp", "Brain Bank", 500], ["xp", "Mastermind", 1000], ["challenge", "Challenger", 1],
    ["champion", "Champion", 1], ["night", "Night Owl", 1], ["early", "Early Bird", 1], ["exam", "Exam Ready", 1],
  ];
  // These are the owner's original choices. Changing them on purpose is fine, so this only prints a note.
  const moved = want.filter(([id, name, at]) => { const t = (byId(id) || { tiers: [] }).tiers.find((x) => x.name === name); return !(t && t.at === at); });
  if (moved.length) console.log("note: the original names/numbers changed for: " + moved.map(([id, name, at]) => `${name} (${id}, ${at})`).join("; "));
}

// every picture exists (exact upper/lower case: GitHub Pages is case-sensitive), is a PNG, is square and has a transparent background
{
  const imgDir = path.join(ROOT, "badges", "img");
  const onDisk = new Set(readdirSync(imgDir));
  const used = new Set();
  for (const f of fams) {
    f.tiers.forEach((t, i) => {
      ok(t.image === `badges/img/${f.id}-${i + 1}.png`, `picture name for "${t.name}" should be badges/img/${f.id}-${i + 1}.png (got ${t.image})`);
      const file = path.basename(t.image);
      used.add(file);
      ok(onDisk.has(file), `picture missing (check the exact spelling and capital letters): ${t.image}`);
      if (!onDisk.has(file)) return;
      const buf = readFileSync(path.join(imgDir, file));
      ok(buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${t.image} is not a real PNG file`);
      if (buf.length < 33) return;
      const w = buf.readUInt32BE(16), hgt = buf.readUInt32BE(20), colourType = buf[25];
      ok(w === hgt, `${t.image} is not square (${w}x${hgt})`);
      ok(w >= 128 && w <= 1024, `${t.image} is ${w}px wide; 256x256 is recommended`);
      const hasAlpha = colourType === 6 || colourType === 4 || buf.includes(Buffer.from("tRNS"));
      ok(hasAlpha, `${t.image} has no transparent background`);
      ok(statSync(path.join(imgDir, file)).size < 400 * 1024, `${t.image} is over 400 KB; shrink it so the app stays fast`);
    });
  }
  const extra = [...onDisk].filter((n) => n.endsWith(".png") && !used.has(n));
  if (extra.length) console.log("note: pictures not used by badges.json: " + extra.join(", "));
}

// the module that draws the screens is valid JavaScript
for (const file of ["js/badges.js", "js/badges-core.js"]) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: readFileSync(path.join(ROOT, file), "utf8"), encoding: "utf8" });
  ok(r.status === 0, `${file} has a syntax error: ${r.stderr}`);
}

// which snapshot keys does the catalogue use?
{
  const used = new Set(fams.map((f) => f.metric));
  const unused = SNAPSHOT_KEYS.filter((k) => !used.has(k));
  console.log(`catalogue: ${fams.length} families, ${totalTiers} tiers; snapshot keys not used by any badge: ${unused.join(", ") || "none"}`);
  ok(new Set(SNAPSHOT_KEYS).size === SNAPSHOT_KEYS.length && SNAPSHOT_KEYS.length === 21, "SNAPSHOT_KEYS has the 21 agreed keys, once each");
}

/* =========================================================== evaluateBadges =========================================================== */
// The exact-number tests below run on this frozen copy of the main badges, so changing numbers or names in badges.json never breaks them.
// (The general rules are also checked against the real badges.json further down.)
const T = (name, rank, at, how) => ({ name, rank, at, image: "badges/img/x.png", how });
const FX = { version: 1, families: [
  { id: "game-on", name: "Games", metric: "gamesPlayed", unit: "games", minLevel: 1, tiers: [T("Game On", "Rookie", 1, "Play your first game"), T("Warmed Up", "Regular", 10, "Play 10 games"), T("High Scorer", "Veteran", 50, "Play 50 games"), T("Arcade Legend", "Legend", 200, "Play 200 games")] },
  { id: "correct", name: "Right Answers", metric: "correctAnswers", unit: "correct answers", minLevel: 1, tiers: [T("Busy Beaver", "Quartz", 10, "Answer 10 questions correctly"), T("Quiz Whiz", "Topaz", 50, "Answer 50 questions correctly")] },
  { id: "streak", name: "Streak", metric: "streak", unit: "days", minLevel: 1, cheer: ["{remaining} more {unit} to unlock {next}. You've got this!"], tiers: [T("Hot Streak", "Copper", 3, "Study 3 days in a row"), T("On Fire", "Silver", 7, "Study 7 days in a row"), T("Unstoppable", "Gold", 30, "Study 30 days in a row"), T("Eternal Flame", "Platinum", 100, "Study 100 days in a row")] },
  { id: "level", name: "Level Up", metric: "level", unit: "levels", minLevel: 1, tiers: [T("High Five", "Yellow Belt", 5, "Reach level 5"), T("Double Digits", "Green Belt", 10, "Reach level 10"), T("Level Boss", "Black Belt", 20, "Reach level 20")] },
  { id: "share", name: "Sharing", metric: "shares", unit: "friends", minLevel: 1, tiers: [T("Study Buddy", "Private", 1, "Share a game with a friend"), T("Squad Goals", "Sergeant", 5, "Share a game with 5 friends")] },
  { id: "review", name: "Review", metric: "reviews", unit: "reviews", minLevel: 1, tiers: [T("Golden Critic", "Gold", 1, "Review the app from your profile")] },
  { id: "accuracy", name: "Accuracy", metric: "quizBest", unit: "percentage points", suffix: "%", minLevel: 2, tiers: [T("Sharpshooter", "Red Ring", 90, "Score 90% or more on a quiz"), T("Bullseye", "Gold Ring", 100, "Score 100% on a quiz")] },
  { id: "night", name: "Night Sessions", metric: "nightSessions", unit: "nights", minLevel: 3, tiers: [T("Night Owl", "Crescent", 1, "Study after 10 pm")] },
] };
const FXTIERS = FX.families.reduce((n, f) => n + f.tiers.length, 0);
ok(validateBadgeConfig(FX).length === 0, "the test's own fixture is a valid config: " + validateBadgeConfig(FX).join("; "));
const ev = (snap, saved) => evaluateBadges(FX, snap, saved);
const evLive = (snap, saved) => evaluateBadges(config, snap, saved);
const fam = (m, id) => m.families.find((f) => f.id === id);

// a brand-new account: the six starters are visible and nothing is earned
{
  const m = ev(snapOf({}), undefined);
  eq(m.families.filter((f) => f.visible).map((f) => f.id), ["game-on", "correct", "streak", "level", "share", "review"], "a new account sees exactly the six starter badges, in order");
  ok(m.families.length === FX.families.length, "every family is in the model");
  ok(m.families.every((f) => f.earnedCount === 0 && f.current === null && f.tiers.every((t) => !t.earned)), "nothing earned for a new account");
  eq(m.fresh, [], "nothing is fresh for a new account");
  eq(m.saved, {}, "nothing to save for a new account");
  const s = fam(m, "streak");
  ok(s.next.name === "Hot Streak" && s.remaining === 3 && s.value === 0, "new account: next is Hot Streak, 3 days away");
  ok(WAKE_CHEER.some((c) => s.cheer === c.replace("{how}", "Study 3 days in a row")), "new account cheer is a wake-up line built from the how text: " + s.cheer);
  eq(badgeTotals(m), { earned: 0, total: FXTIERS, visible: 6 }, "totals for a new account");
  eq(evLive(snapOf({}), undefined).families.filter((f) => f.visible).map((f) => f.id), fams.slice(0, 6).map((f) => f.id), "the real badges.json also shows exactly the six starters to a new account");
}
// missing keys count as 0, junk counts as 0, and no snapshot at all does not crash
{
  const m = ev({ level: 1, streak: "x", gamesPlayed: NaN, xp: -50, shares: undefined }, undefined);
  ok(m.families.filter((f) => f.metric !== "level").every((f) => f.value === 0), "junk values count as 0");
  ok(evaluateBadges(FX, undefined, undefined).families.length === FX.families.length, "undefined snapshot does not throw");
  ok(evaluateBadges(FX, null, null).families.length === FX.families.length, "null snapshot does not throw");
  const e = evaluateBadges(null, { level: 3 }, { streak: 2 });
  eq([e.families, e.fresh, e.saved], [[], [], { streak: 2 }], "no config: nothing shown, saved is kept");
  const e2 = evaluateBadges({ families: [null, { id: "x" }, { id: "y", tiers: [{ at: "z" }] }] }, {}, {});
  eq(e2.families, [], "malformed families are skipped, not crashed on");
}
// thresholds produce fresh, in order
{
  let m = ev(snapOf({ gamesPlayed: 1 }), {});
  eq(m.fresh.map((x) => x.tier.name), ["Game On"], "first game earns Game On");
  eq(m.saved, { "game-on": 1 }, "saved remembers 1 tier");
  eq(ev(snapOf({ gamesPlayed: 9 }), m.saved).fresh, [], "9 games: nothing new");
  m = ev(snapOf({ gamesPlayed: 10 }), m.saved);
  eq(m.fresh.map((x) => x.tier.name), ["Warmed Up"], "10 games earns Warmed Up only");
  eq(m.saved, { "game-on": 2 }, "saved moves to 2");
  // a jump over several thresholds, several families at once: config order, then tier order
  const j = ev(snapOf({ gamesPlayed: 50, streak: 7, correctAnswers: 10, reviews: 1 }), undefined);
  eq(j.fresh.map((x) => x.tier.name), ["Game On", "Warmed Up", "High Scorer", "Busy Beaver", "Hot Streak", "On Fire", "Golden Critic"], "fresh is ordered by family, then tier");
  eq(j.saved, { "game-on": 3, correct: 1, streak: 2, review: 1 }, "saved after a jump");
  ok(j.fresh.every((x) => j.families.includes(x.family) && x.family.tiers.includes(x.tier)), "fresh items point at the model's own family and tier objects");
  eq(ev(snapOf({ gamesPlayed: 50, streak: 7, correctAnswers: 10, reviews: 1 }), j.saved).fresh, [], "evaluating again with the new saved map gives nothing fresh");
  // exactly on the threshold counts
  eq(ev(snapOf({ streak: 3 }), {}).fresh.map((x) => x.tier.name), ["Hot Streak"], "at == value counts as earned");
  eq(ev(snapOf({ streak: 2 }), {}).fresh, [], "one short does not");
  // percentages
  eq(ev(snapOf({ quizBest: 89 }), {}).fresh, [], "89% is not Sharpshooter");
  eq(ev(snapOf({ quizBest: 90 }), {}).fresh.map((x) => x.tier.name), ["Sharpshooter"], "90% is Sharpshooter");
  eq(ev(snapOf({ quizBest: 100 }), {}).fresh.map((x) => x.tier.name), ["Sharpshooter", "Bullseye"], "100% is both");
}
// saved never decreases
{
  const base = ev(snapOf({ streak: 7 }), {});
  eq(base.saved, { streak: 2 }, "streak 7 saves 2");
  const dropped = ev(snapOf({ streak: 1 }), base.saved);
  const s = fam(dropped, "streak");
  eq(dropped.saved, { streak: 2 }, "a streak that breaks does not lower saved");
  ok(s.earnedCount === 2 && s.current.name === "On Fire" && s.tiers[0].earned && s.tiers[1].earned && !s.tiers[2].earned, "earned badges are kept when the metric drops");
  ok(s.next.name === "Unstoppable" && s.remaining === 29 && s.value === 1, "after the drop, the goal is measured from the current value");
  eq(dropped.fresh, [], "a drop and a recovery to the old level is not fresh again");
  eq(ev(snapOf({ streak: 3 }), dropped.saved).fresh, [], "going back up over an earned tier is not fresh");
  // saved from a newer config (more tiers than today) or a removed family is never lost
  const odd = ev(snapOf({}), { streak: 99, gone: 3, review: 1 });
  eq(odd.saved, { streak: 99, gone: 3, review: 1 }, "unknown or larger saved numbers are kept");
  ok(fam(odd, "streak").earnedCount === 4 && fam(odd, "streak").next === null, "saved bigger than the ladder counts as complete, no crash");
  ok(fam(odd, "review").earnedCount === 1, "saved says earned even though the metric is 0");
  ok(fam(odd, "review").visible, "an earned badge is visible");
  // junk in saved is ignored safely
  const junk = ev(snapOf({}), { streak: "two", level: -4, review: NaN });
  eq(junk.saved, {}, "junk saved values count as 0");
  // the input objects are not changed
  const sv = { streak: 1 }, sn = { level: 1, streak: 30 };
  ev(sn, sv);
  eq([sv, sn], [{ streak: 1 }, { level: 1, streak: 30 }], "inputs are not mutated");
}
// remaining, next, current, progress and the cheer
{
  const s4 = fam(ev(snapOf({ streak: 3 }), {}), "streak");
  ok(s4.current.name === "Hot Streak" && s4.next.name === "On Fire" && s4.remaining === 4 && s4.earnedCount === 1, "streak 3: Hot Streak earned, On Fire is 4 away");
  ok(Math.abs(s4.progress - 3 / 7) < 1e-9, "progress is value / next.at");
  ok(s4.cheer.includes("On Fire") && /\b4\b/.test(s4.cheer) && /days/.test(s4.cheer), "cheer names the next tier and says 4 days: " + s4.cheer);
  const s6 = fam(ev(snapOf({ streak: 6 }), {}), "streak");
  ok(s6.remaining === 1 && /\b1 (more )?day\b/.test(s6.cheer) && !/1 days/.test(s6.cheer), "one day left uses the singular: " + s6.cheer);
  const full = fam(ev(snapOf({ streak: 100 }), {}), "streak");
  ok(full.next === null && full.remaining === null && full.earnedCount === 4 && full.current.name === "Eternal Flame" && full.progress === 1, "a complete family has no next and no remaining");
  ok(DONE_CHEER.some((c) => full.cheer === c.replace("{name}", full.name)), "a complete family gets a done line: " + full.cheer);
  const r = fam(ev(snapOf({ reviews: 1 }), {}), "review");
  ok(r.next === null && r.earnedCount === 1, "single-tier family is complete after one");
  // the owner's example wording
  const two = fam(ev(snapOf({ streak: 5 }), {}), "streak");
  ok(two.cheer.includes("2 more days") || two.cheer.includes("2 days"), "streak 5: two days to On Fire: " + two.cheer);
  // the cheer is stable (no flicker on redraw) and changes with the value
  eq(fam(ev(snapOf({ streak: 5 }), {}), "streak").cheer, two.cheer, "same input, same cheer");
}
// cheer placeholders are always filled, for every family at many values
{
  for (const f of fams) {
    const values = new Set([0, 1]);
    for (const t of f.tiers) { values.add(t.at - 1); values.add(t.at); values.add(t.at + 1); }
    values.add(100000);
    for (const v of values) {
      if (v < 0) continue;
      const m = evLive(snapOf({ [f.metric]: v, ...(f.metric === "level" ? { level: Math.max(1, v) } : {}) }), {});
      const x = fam(m, f.id);
      ok(typeof x.cheer === "string" && x.cheer.length > 8 && !/[{}]|undefined|NaN|null/.test(x.cheer), `${f.id} at ${v}: bad cheer "${x.cheer}"`);
      if (x.next) ok(x.cheer.includes(x.next.name) || x.value === 0, `${f.id} at ${v}: the cheer should name the next tier: "${x.cheer}"`);
      ok(x.remaining === null ? x.next === null : x.remaining >= 1, `${f.id} at ${v}: remaining must be 1 or more while there is a next tier`);
    }
  }
  // all default lines work with a unit and with a singular unit
  for (const c of [...DEFAULT_CHEER, ...WAKE_CHEER]) ok(/[{]/.test(c), "template has a placeholder");
}
// a level-up reveals later families; an earned badge shows even below its level
{
  const visIds = (level) => ev({ level }, {}).families.filter((f) => f.visible).map((f) => f.id);
  for (let L = 1; L <= 9; L++) eq(visIds(L), FX.families.filter((f) => f.minLevel <= L).map((f) => f.id), `visible families at level ${L}`);
  ok(visIds(1).length === 6 && visIds(2).length === 7 && visIds(3).length === 8, "level 1 shows 6, level 2 shows 7, level 3 shows 8");
  // the same rule on the real badges.json
  const liveIds = (level) => evLive({ level }, {}).families.filter((f) => f.visible).map((f) => f.id);
  for (let L = 1; L <= 9; L++) eq(liveIds(L), fams.filter((f) => f.minLevel <= L).map((f) => f.id), `real badges: visible families at level ${L}`);
  ok(liveIds(1).length === 6 && liveIds(2).length > 6 && liveIds(8).length === fams.length, "real badges: level 1 shows 6, level 2 shows more, level 8 shows all");
  ok(!visIds(1).includes("night"), "Night Owl is hidden at level 1");
  const early = ev({ level: 1, nightSessions: 1 }, {});
  ok(fam(early, "night").visible && fam(early, "night").earnedCount === 1, "a badge earned below its level is visible");
  // visible order: starters first in config order, later ones in config order
  eq(ev({ level: 9 }, {}).families.map((f) => f.id), FX.families.map((f) => f.id), "the model keeps the config order");
  eq(evLive({ level: 9 }, {}).families.map((f) => f.id), fams.map((f) => f.id), "the model keeps the real config order");
  // a snapshot without a level still shows the starters
  eq(ev({}, {}).families.filter((f) => f.visible).map((f) => f.id), FX.families.slice(0, 6).map((f) => f.id), "no level in the snapshot: starters still show");
}
// the level badge reads the level itself
{
  const m = ev({ level: 5 }, {});
  eq(m.fresh.map((x) => x.tier.name), ["High Five"], "level 5 earns High Five");
  eq(fam(ev({ level: 20 }, {}), "level").tiers.map((t) => t.earned), [true, true, true], "level 20 earns all three level tiers");
}
// every tier of every family can be earned by exactly its threshold, in order
for (const f of fams) {
  let saved = {};
  f.tiers.forEach((t, i) => {
    const m = evaluateBadges(config, { level: 1, [f.metric]: t.at }, saved);
    const x = m.families.find((y) => y.id === f.id);
    ok(x.earnedCount === i + 1 && m.fresh.length === 1 && m.fresh[0].tier.name === t.name, `${f.id}: reaching ${t.at} earns exactly "${t.name}"`);
    saved = m.saved;
  });
}

/* =========================================================== helpers used by the screens =========================================================== */
{
  const m = ev(snapOf({ streak: 3 }), {});
  const s = fam(m, "streak");
  eq(tileAriaLabel(s), "Hot Streak, Copper rank, earned. Next: On Fire, 4 more days", "tile label when earned (the owner's example)");
  eq(tileAriaLabel(fam(ev(snapOf({}), {}), "streak")), "Hot Streak, locked. Study 3 days in a row", "tile label when locked (the owner's example)");
  eq(tileAriaLabel(fam(ev(snapOf({ streak: 100 }), {}), "streak")), "Eternal Flame, Platinum rank, earned. Every tier unlocked", "tile label when complete");
  eq(progressText(s), "3 / 7", "progress text");
  eq(progressText(fam(ev(snapOf({ quizBest: 72 }), {}), "accuracy")), "72% / 90%", "progress text with a % suffix");
  eq(progressText(fam(ev(snapOf({ streak: 100 }), {}), "streak")), "Complete", "progress text when complete");
  eq(tierImageAlt(s, s.tiers[0]), "Hot Streak badge, Copper rank", "image alt text");
  eq(nextGoalText(s, s.tiers[0]), "Next: On Fire, 4 more days", "celebration next goal");
  const jump = fam(ev(snapOf({ streak: 8 }), {}), "streak");
  ok(/already earned/.test(nextGoalText(jump, jump.tiers[0])), "celebration of a tier whose next tier is also earned says so");
  ok(/every tier/.test(nextGoalText(fam(ev(snapOf({ streak: 100 }), {}), "streak"), { index: 3 })), "celebration of the last tier says it is the last");
  eq(nextGoalText(fam(ev(snapOf({ quizBest: 90 }), {}), "accuracy"), fam(ev(snapOf({ quizBest: 90 }), {}), "accuracy").tiers[0]), "Next: Bullseye, 10 more percentage points", "unit with two words");
  eq(badgeTotals(ev(snapOf({ streak: 7, gamesPlayed: 1 }), {})), { earned: 3, total: FXTIERS, visible: 6 }, "totals");
  eq([singular("days"), singular("classes"), singular("XP"), singular("percentage points"), singular("practice tests"), singular("wins"), singular("")], ["day", "class", "XP", "percentage point", "practice test", "win", ""], "singular()");
  eq([initials("Speed of Light"), initials("Game On"), initials("Unstoppable"), initials("XP"), initials("")], ["SL", "GO", "UN", "XP", "?"], "initials()");
  eq([formatCount(5), formatCount(1000), formatCount(2.5)], ["5", "1,000", "2.5"], "formatCount()");
}

if (fails) { console.error(`${fails} badge test(s) failed (${passes} passed)`); process.exit(1); }
console.log(`all badge tests passed (${passes} checks)`);
