// Tests for the badge system: the config (badges/badges.json + the pictures) and the pure logic in js/badges-core.js.
// Run: node tools/test_badges.mjs     (exits with a non-zero code on any failure)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SNAPSHOT_KEYS, TIER_NAMES, evaluateBadges, validateBadgeConfig, tierImageAlt, tileLine, progressText, nextGoalText, badgeTotals, badgeTitle,
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

// the checker catches the usual mistakes
{
  const mk = (edit) => { const c = structuredClone(config); edit(c); return validateBadgeConfig(c); };
  ok(mk((c) => { c.families[0].metric = "gamesPlayd"; }).some((p) => p.includes("unknown metric")), "an unknown metric must be reported");
  ok(mk((c) => { c.families[0].tiers[1].at = 1; }).some((p) => p.includes("bigger than")), "tiers must be strictly ascending (equal)");
  ok(mk((c) => { c.families[0].tiers[2].at = 5; }).some((p) => p.includes("bigger than")), "tiers must be strictly ascending (descending)");
  ok(mk((c) => { c.families[1].id = "game-on"; }).some((p) => p.includes("duplicate family id")), "duplicate family ids are reported");
  ok(mk((c) => { c.families[1].name = "game on"; }).some((p) => p.includes("duplicate family name")), "duplicate family names are reported (any case)");
  ok(mk((c) => { c.families[2].tiers[1].name = "3-day streak"; }).some((p) => p.includes("duplicate tier name")), "duplicate tier names inside a family are reported (any case)");
  ok(mk((c) => { c.families[6].minLevel = 0; }).some((p) => p.includes("minLevel")), "minLevel 0 is reported");
  ok(mk((c) => { c.families[6].minLevel = 2.5; }).some((p) => p.includes("minLevel")), "minLevel must be a whole number");
  ok(mk((c) => { c.families[0].tiers[0].image = "badges/img/x.jpg"; }).some((p) => p.includes(".png")), "a non-PNG image is reported");
  ok(mk((c) => { c.families[2].cheer = ["{oops} days"]; }).some((p) => p.includes("placeholder")), "an unknown cheer placeholder is reported");
  ok(mk((c) => { delete c.families[0].tiers[0].how; }).some((p) => p.includes("how")), "a missing how is reported");
  ok(mk((c) => { c.families[0].tiers[0].rank = "Rookie"; }).some((p) => p.includes("rank")), 'the old "rank" field is reported');
  ok(mk((c) => { c.families[0].tiers = Array.from({ length: 9 }, (_, i) => ({ at: i + 1, image: "badges/img/a.png", how: "Do it" })); }).some((p) => p.includes("more than 8 tiers")), "9 tiers without their own names are reported");
  ok(!mk((c) => { c.families[0].tiers = Array.from({ length: 9 }, (_, i) => ({ name: "Step " + (i + 1), at: i + 1, image: "badges/img/a.png", how: "Do it" })); }).some((p) => p.includes("more than 8 tiers")), "9 tiers with their own names are fine");
  ok(validateBadgeConfig({}).length > 0 && validateBadgeConfig(null).length > 0, "junk is not a valid config");
}

// the six starters come first and are the only ones at level 1
eq(fams.slice(0, 6).map((f) => f.id), ["game-on", "busy-beaver", "hot-streak", "high-five", "study-buddy", "golden-critic"], "starter families, in the owner's order");
ok(fams.filter((f) => f.minLevel === 1).length === 6 && fams.slice(0, 6).every((f) => f.minLevel === 1), "exactly the first six families have minLevel 1");
{
  const mins = fams.slice(6).map((f) => f.minLevel);
  ok(mins.every((m) => m >= 2), "later badges appear from level 2 up");
  if (!mins.every((m, i) => i === 0 || m >= mins[i - 1])) console.log("note: later badges are not listed in the order they unlock (the grid follows the order in the file)");
}

// The owner's tables: family, stat it tracks, thresholds. Changing a number on purpose is fine, so a difference only prints a note.
const SPEC = {
  "game-on": ["gamesPlayed", [1, 10, 50, 100]], "busy-beaver": ["correctAnswers", [10, 50, 100, 250, 500]],
  "hot-streak": ["streak", [3, 5, 10, 15, 20, 30, 40, 50, 75, 100]], "high-five": ["level", [5, 10, 20, 30, 50]],
  "study-buddy": ["shares", [1, 5, 10]], "golden-critic": ["reviews", [1]],
  flash: ["sprintBeats", [1, 2, 3, 4, 5, 6, 7, 8]], sharpshooter: ["quizzes90", [1, 5, 10, 25]], bullseye: ["quizzes100", [1, 5, 10]],
  "card-shark": ["cardsReviewed", [50, 200, 500, 1000]], "deck-master": ["decksFinished", [1, 5, 10]], "word-nerd": ["glossaryStudied", [25, 100, 250]],
  "comeback-kid": ["comebacks", [1, 5, 10]], "topic-tamer": ["topicsTamed", [1, 5, 10, 25]], "class-conqueror": ["classesConquered", [1, 3, 5]],
  "brain-bank": ["xp", [100, 500, 1000, 2500, 5000]], challenger: ["challengesSent", [1, 5, 10, 25]], champion: ["challengesWon", [1, 5, 10, 25]],
  "night-owl": ["nightSessions", [1, 10, 25]], "early-bird": ["earlySessions", [1, 10, 25]], "exam-ready": ["examPrepped", [1, 3, 5]],
};
{
  const differs = [];
  for (const [id, [metric, ats]] of Object.entries(SPEC)) {
    const f = byId(id);
    if (!f) { differs.push(`${id} is missing`); continue; }
    if (f.metric !== metric || JSON.stringify(f.tiers.map((t) => t.at)) !== JSON.stringify(ats)) differs.push(id);
  }
  for (const f of fams) if (!(f.id in SPEC)) differs.push(`${f.id} (extra)`);
  if (differs.length) console.log("note: these badges differ from the owner's original tables: " + differs.join(", "));
  ok(fams.length >= 21, "the 21 families of the owner's list are there (or more)");
}

// tier names: Bronze, Silver, Gold ... by position; Hot Streak is named by day count; a single badge has no tier name
{
  const m = evaluateBadges(config, snapOf({}), {});
  for (const f of m.families) {
    const raw = byId(f.id);
    if (f.id === "hot-streak") { ok(f.tiers.every((t) => t.name === `${t.at}-Day Streak`), "Hot Streak tiers are named by day count"); continue; }
    if (f.tiers.length === 1) { ok(f.tiers[0].name === "", `${f.id}: a single badge has no tier name`); continue; }
    ok(f.tiers.every((t, i) => t.name === TIER_NAMES[i]), `${f.id}: tiers are ${TIER_NAMES.slice(0, f.tiers.length).join(", ")} (got ${f.tiers.map((t) => t.name).join(", ")})`);
    ok(raw.tiers.every((t) => !("name" in t)), `${f.id}: leave "name" out of the tiers to get the default names`);
  }
  eq(TIER_NAMES, ["Bronze", "Silver", "Gold", "Emerald", "Diamond", "Ruby", "Celestial", "Legendary"], "the default tier order");
  eq(byId("flash").tiers.length, 8, "Flash uses all eight tier names");
}

// no scientist names; "how" lines never talk about lectures, slides or textbooks
const SCIENTISTS = ["Newton", "Einstein", "Tesla", "Curie", "Faraday", "Franklin", "Darwin", "Galileo", "Hawking", "Kepler", "Pasteur", "Mendel", "Bohr", "Feynman", "Edison", "Copernicus", "Hubble", "Lavoisier", "Mendeleev", "Pythagoras", "Archimedes", "Euclid", "Gauss", "Euler", "Fermat", "Turing", "Lovelace", "Maxwell", "Planck", "Sagan", "Goodall", "Hooke", "Lyell", "Wegener"];
const sciRe = new RegExp("\\b(" + SCIENTISTS.join("|") + ")\\b", "i");
for (const f of fams) {
  ok(!sciRe.test(f.name), `family name "${f.name}" contains a scientist's name`);
  for (const t of f.tiers) {
    ok(!sciRe.test(t.name || ""), `tier "${t.name}" contains a scientist's name`);
    ok(!/lectures?|slides?|textbooks?|biolog|chemi|physic|astronom|geolog|math/i.test(t.how + " " + (t.name || "") + " " + f.name), `badge text must work for every class (no subject words): ${f.name}: ${t.how}`);
    ok(t.how.trim().length >= 8, `how line of "${f.name}" tier ${t.at} is too short`);
    ok(!/[.]$/.test(t.how.trim()), `how line of "${f.name}" tier ${t.at} should not end with a full stop (the app adds " to unlock")`);
  }
}

// every picture exists (exact upper/lower case: GitHub Pages is case-sensitive), is a PNG, is square and has a transparent background
let totalTiers = 0;
{
  const imgDir = path.join(ROOT, "badges", "img");
  const onDisk = new Set(readdirSync(imgDir));
  const used = new Set();
  for (const f of fams) {
    f.tiers.forEach((t, i) => {
      totalTiers++;
      ok(t.image === `badges/img/${f.id}-${i + 1}.png`, `picture name for "${f.name}" tier ${i + 1} should be badges/img/${f.id}-${i + 1}.png (got ${t.image})`);
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

// the modules that draw the screens are valid JavaScript
for (const file of ["js/badges.js", "js/badges-core.js"]) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: readFileSync(path.join(ROOT, file), "utf8"), encoding: "utf8" });
  ok(r.status === 0, `${file} has a syntax error: ${r.stderr}`);
}

// which snapshot keys does the catalogue use?
{
  const used = new Set(fams.map((f) => f.metric));
  const unused = SNAPSHOT_KEYS.filter((k) => !used.has(k));
  console.log(`catalogue: ${fams.length} families, ${totalTiers} tiers; snapshot keys not used by any badge: ${unused.join(", ") || "none"}`);
  ok(new Set(SNAPSHOT_KEYS).size === SNAPSHOT_KEYS.length && SNAPSHOT_KEYS.length === 23, "SNAPSHOT_KEYS has the 23 agreed keys, once each");
}

/* =========================================================== evaluateBadges =========================================================== */
// The exact-number tests below run on this frozen copy of some badges, so changing numbers or names in badges.json never breaks them.
// (The general rules are also checked against the real badges.json further down.)
const T = (at, how, name) => ({ ...(name ? { name } : {}), at, image: "badges/img/x.png", how });
const FX = { version: 1, families: [
  { id: "game-on", name: "Game On", metric: "gamesPlayed", unit: "games", minLevel: 1, tiers: [T(1, "Play your first game"), T(10, "Play 10 games"), T(50, "Play 50 games"), T(100, "Play 100 games")] },
  { id: "busy-beaver", name: "Busy Beaver", metric: "correctAnswers", unit: "correct answers", minLevel: 1, tiers: [T(10, "Get 10 questions right"), T(50, "Get 50 questions right")] },
  { id: "hot-streak", name: "Hot Streak", metric: "streak", unit: "days", minLevel: 1, cheer: ["{remaining} more {unit} to unlock {next}. You've got this!"],
    tiers: [T(3, "Study 3 days in a row", "3-Day Streak"), T(5, "Study 5 days in a row", "5-Day Streak"), T(10, "Study 10 days in a row", "10-Day Streak")] },
  { id: "high-five", name: "High Five", metric: "level", unit: "levels", minLevel: 1, tiers: [T(5, "Reach level 5"), T(10, "Reach level 10"), T(20, "Reach level 20")] },
  { id: "study-buddy", name: "Study Buddy", metric: "shares", unit: "shares", minLevel: 1, tiers: [T(1, "Share a game with a friend"), T(5, "Share 5 games with friends"), T(10, "Share 10 games with friends")] },
  { id: "golden-critic", name: "Golden Critic", metric: "reviews", unit: "reviews", minLevel: 1, tiers: [T(1, "Write a review from your profile")] },
  { id: "sharpshooter", name: "Sharpshooter", metric: "quizzes90", unit: "quizzes", minLevel: 2, tiers: [T(1, "Score 90% or more on a quiz"), T(5, "Score 90% or more on 5 quizzes")] },
  { id: "night-owl", name: "Night Owl", metric: "nightSessions", unit: "nights", minLevel: 3, tiers: [T(1, "Study after 10 pm")] },
  { id: "flash", name: "Flash", metric: "sprintBeats", unit: "personal bests", minLevel: 2, tiers: [T(1, "Beat your personal best in the 60-second sprint (for example 6 correct, then 9)"), T(2, "Beat your sprint personal best 2 times")] },
] };
const FXTIERS = FX.families.reduce((n, f) => n + f.tiers.length, 0);
const STARTERS = ["game-on", "busy-beaver", "hot-streak", "high-five", "study-buddy", "golden-critic"];
ok(validateBadgeConfig(FX).length === 0, "the test's own fixture is a valid config: " + validateBadgeConfig(FX).join("; "));
const ev = (snap, saved) => evaluateBadges(FX, snap, saved);
const evLive = (snap, saved) => evaluateBadges(config, snap, saved);
const fam = (m, id) => m.families.find((f) => f.id === id);
const line = (snap, id) => tileLine(fam(ev(snapOf(snap), {}), id));

// a brand-new account: the six starters are visible and nothing is earned
{
  const m = ev(snapOf({}), undefined);
  eq(m.families.filter((f) => f.visible).map((f) => f.id), STARTERS, "a new account sees exactly the six starter badges, in order");
  ok(m.families.length === FX.families.length, "every family is in the model");
  ok(m.families.every((f) => f.earnedCount === 0 && f.current === null && f.tiers.every((t) => !t.earned)), "nothing earned for a new account");
  eq(m.fresh, [], "nothing is fresh for a new account");
  eq(m.saved, {}, "nothing to save for a new account");
  const s = fam(m, "hot-streak");
  ok(s.next.name === "3-Day Streak" && s.remaining === 3 && s.value === 0, "new account: next is 3-Day Streak, 3 days away");
  ok(WAKE_CHEER.some((c) => s.cheer === c.replace("{how}", "Study 3 days in a row")), "new account cheer is a wake-up line built from the how text: " + s.cheer);
  const visibleTiers = FX.families.filter((f) => STARTERS.includes(f.id)).reduce((n, f) => n + f.tiers.length, 0);
  eq(badgeTotals(m), { earned: 0, total: visibleTiers, visible: 6 }, "totals count only the tiers of the badges the person can see");
  eq(evLive(snapOf({}), undefined).families.filter((f) => f.visible).map((f) => f.id), fams.slice(0, 6).map((f) => f.id), "the real badges.json also shows exactly the six starters to a new account");
  ok(evLive(snapOf({}), undefined).families.filter((f) => f.visible).every((f) => f.earnedCount === 0), "the real badges are all locked for a new account");
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
  eq(m.fresh.map((x) => badgeTitle(x.family, x.tier)), ["Game On – Bronze"], "first game earns Game On – Bronze");
  eq(m.saved, { "game-on": 1 }, "saved remembers 1 tier");
  eq(ev(snapOf({ gamesPlayed: 9 }), m.saved).fresh, [], "9 games: nothing new");
  m = ev(snapOf({ gamesPlayed: 10 }), m.saved);
  eq(m.fresh.map((x) => badgeTitle(x.family, x.tier)), ["Game On – Silver"], "10 games earns Silver only");
  eq(m.saved, { "game-on": 2 }, "saved moves to 2");
  // a jump over several thresholds, several families at once: config order, then tier order
  const j = ev(snapOf({ gamesPlayed: 50, streak: 5, correctAnswers: 10, reviews: 1 }), undefined);
  eq(j.fresh.map((x) => badgeTitle(x.family, x.tier)), ["Game On – Bronze", "Game On – Silver", "Game On – Gold", "Busy Beaver – Bronze", "Hot Streak – 3-Day Streak", "Hot Streak – 5-Day Streak", "Golden Critic"], "fresh is ordered by family, then tier");
  eq(j.saved, { "game-on": 3, "busy-beaver": 1, "hot-streak": 2, "golden-critic": 1 }, "saved after a jump");
  ok(j.fresh.every((x) => j.families.includes(x.family) && x.family.tiers.includes(x.tier)), "fresh items point at the model's own family and tier objects");
  eq(ev(snapOf({ gamesPlayed: 50, streak: 5, correctAnswers: 10, reviews: 1 }), j.saved).fresh, [], "evaluating again with the new saved map gives nothing fresh");
  // exactly on the threshold counts
  eq(ev(snapOf({ streak: 3 }), {}).fresh.map((x) => x.tier.name), ["3-Day Streak"], "at == value counts as earned");
  eq(ev(snapOf({ streak: 2 }), {}).fresh, [], "one short does not");
  // quizzes at 90% and at 100% are counted, not just the best score
  eq(ev(snapOf({ quizzes90: 0 }), {}).fresh, [], "no quiz at 90%: no Sharpshooter");
  eq(ev(snapOf({ quizzes90: 1 }), {}).fresh.map((x) => badgeTitle(x.family, x.tier)), ["Sharpshooter – Bronze"], "one quiz at 90% is Sharpshooter Bronze");
  eq(ev(snapOf({ quizzes90: 5 }), {}).fresh.map((x) => x.tier.name), ["Bronze", "Silver"], "five quizzes at 90% jump to Silver");
  // the sprint: each personal best moves up one tier
  eq(ev(snapOf({ sprintBeats: 1 }), {}).fresh.map((x) => x.tier.name), ["Bronze"], "the first beaten personal best is Flash Bronze");
  eq(ev(snapOf({ sprintBeats: 2 }), { flash: 1 }).fresh.map((x) => x.tier.name), ["Silver"], "the next beaten personal best is Flash Silver");
}
// saved never decreases
{
  const base = ev(snapOf({ streak: 5 }), {});
  eq(base.saved, { "hot-streak": 2 }, "streak 5 saves 2");
  const dropped = ev(snapOf({ streak: 1 }), base.saved);
  const s = fam(dropped, "hot-streak");
  eq(dropped.saved, { "hot-streak": 2 }, "a streak that breaks does not lower saved");
  ok(s.earnedCount === 2 && s.current.name === "5-Day Streak" && s.tiers[0].earned && s.tiers[1].earned && !s.tiers[2].earned, "earned badges are kept when the metric drops");
  ok(s.next.name === "10-Day Streak" && s.remaining === 9 && s.value === 1, "after the drop, the goal is measured from the current value");
  eq(dropped.fresh, [], "a drop and a recovery to the old level is not fresh again");
  eq(ev(snapOf({ streak: 3 }), dropped.saved).fresh, [], "going back up over an earned tier is not fresh");
  // saved from a newer config (more tiers than today) or a removed family is never lost
  const odd = ev(snapOf({}), { "hot-streak": 99, gone: 3, "golden-critic": 1 });
  eq(odd.saved, { "hot-streak": 99, gone: 3, "golden-critic": 1 }, "unknown or larger saved numbers are kept");
  ok(fam(odd, "hot-streak").earnedCount === 3 && fam(odd, "hot-streak").next === null, "saved bigger than the ladder counts as complete, no crash");
  ok(fam(odd, "golden-critic").earnedCount === 1, "saved says earned even though the metric is 0");
  ok(fam(odd, "golden-critic").visible, "an earned badge is visible");
  // junk in saved is ignored safely
  const junk = ev(snapOf({}), { "hot-streak": "two", level: -4, "golden-critic": NaN });
  eq(junk.saved, {}, "junk saved values count as 0");
  // the input objects are not changed
  const sv = { "hot-streak": 1 }, sn = { level: 1, streak: 30 };
  ev(sn, sv);
  eq([sv, sn], [{ "hot-streak": 1 }, { level: 1, streak: 30 }], "inputs are not mutated");
}
// remaining, next, current, progress and the cheer
{
  const s4 = fam(ev(snapOf({ streak: 3 }), {}), "hot-streak");
  ok(s4.current.name === "3-Day Streak" && s4.next.name === "5-Day Streak" && s4.remaining === 2 && s4.earnedCount === 1, "streak 3: 3-Day Streak earned, 5-Day Streak is 2 away");
  ok(Math.abs(s4.progress - 3 / 5) < 1e-9, "progress is value / next.at");
  ok(s4.cheer.includes("5-Day Streak") && /\b2\b/.test(s4.cheer) && /days/.test(s4.cheer), "cheer names the next tier and says 2 days: " + s4.cheer);
  const s6 = fam(ev(snapOf({ streak: 9 }), {}), "hot-streak");
  ok(s6.remaining === 1 && /\b1 (more )?day\b/.test(s6.cheer) && !/1 days/.test(s6.cheer), "one day left uses the singular: " + s6.cheer);
  const full = fam(ev(snapOf({ streak: 100 }), {}), "hot-streak");
  ok(full.next === null && full.remaining === null && full.earnedCount === 3 && full.current.name === "10-Day Streak" && full.progress === 1, "a complete family has no next and no remaining");
  ok(DONE_CHEER.some((c) => full.cheer === c.replace("{name}", full.name)), "a complete family gets a done line: " + full.cheer);
  const r = fam(ev(snapOf({ reviews: 1 }), {}), "golden-critic");
  ok(r.next === null && r.earnedCount === 1, "single-tier family is complete after one");
  // the cheer is stable (no flicker on redraw)
  eq(fam(ev(snapOf({ streak: 4 }), {}), "hot-streak").cheer, fam(ev(snapOf({ streak: 4 }), {}), "hot-streak").cheer, "same input, same cheer");
}
// cheer placeholders are always filled, for every real family at many values
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
      if (x.next && x.value > 0) ok(x.cheer.includes(x.next.name) || x.cheer.includes(x.name), `${f.id} at ${v}: the cheer should name the next tier: "${x.cheer}"`);
      ok(x.remaining === null ? x.next === null : x.remaining >= 1, `${f.id} at ${v}: remaining must be 1 or more while there is a next tier`);
      const tl = tileLine(x);
      ok(!/[{}]|undefined|NaN|null/.test(tl.text) && tl.text.length > 8, `${f.id} at ${v}: bad tile line "${tl.text}"`);
    }
  }
  for (const c of [...DEFAULT_CHEER, ...WAKE_CHEER]) ok(/[{]/.test(c), "template has a placeholder");
}
// a level-up reveals later families; an earned badge shows even below its level
{
  const visIds = (level) => ev({ level }, {}).families.filter((f) => f.visible).map((f) => f.id);
  for (let L = 1; L <= 9; L++) eq(visIds(L), FX.families.filter((f) => f.minLevel <= L).map((f) => f.id), `visible families at level ${L}`);
  ok(visIds(1).length === 6 && visIds(2).length === 8 && visIds(3).length === 9, "level 1 shows 6, level 2 shows 8, level 3 shows 9");
  const liveIds = (level) => evLive({ level }, {}).families.filter((f) => f.visible).map((f) => f.id);
  for (let L = 1; L <= 9; L++) eq(liveIds(L), fams.filter((f) => f.minLevel <= L).map((f) => f.id), `real badges: visible families at level ${L}`);
  ok(liveIds(1).length === 6 && liveIds(2).length > 6 && liveIds(8).length === fams.length, "real badges: level 1 shows 6, level 2 shows more, level 8 shows all");
  ok(!visIds(1).includes("night-owl"), "Night Owl is hidden at level 1");
  const early = ev({ level: 1, nightSessions: 1 }, {});
  ok(fam(early, "night-owl").visible && fam(early, "night-owl").earnedCount === 1, "a badge earned below its level is visible");
  eq(ev({ level: 9 }, {}).families.map((f) => f.id), FX.families.map((f) => f.id), "the model keeps the config order");
  eq(evLive({ level: 9 }, {}).families.map((f) => f.id), fams.map((f) => f.id), "the model keeps the real config order");
  eq(ev({}, {}).families.filter((f) => f.visible).map((f) => f.id), STARTERS, "no level in the snapshot: starters still show");
  // totals grow as more badges appear
  const t1 = badgeTotals(ev({ level: 1 }, {})), t3 = badgeTotals(ev({ level: 3 }, {}));
  ok(t3.total > t1.total && t3.visible === 9, "more badges, more tiers to earn, as the person levels up");
}
// the level badge reads the level itself
{
  eq(ev({ level: 5 }, {}).fresh.map((x) => badgeTitle(x.family, x.tier)), ["High Five – Bronze"], "level 5 earns High Five – Bronze");
  eq(fam(ev({ level: 20 }, {}), "high-five").tiers.map((t) => t.earned), [true, true, true], "level 20 earns all three level tiers of the fixture");
}
// every tier of every real family can be earned by exactly its threshold, in order
for (const f of fams) {
  let saved = {};
  f.tiers.forEach((t, i) => {
    const m = evaluateBadges(config, { level: 1, [f.metric]: t.at }, saved);
    const x = m.families.find((y) => y.id === f.id);
    ok(x.earnedCount === i + 1 && m.fresh.length === 1 && m.fresh[0].tier.index === i, `${f.id}: reaching ${t.at} earns exactly tier ${i + 1}`);
    saved = m.saved;
  });
}

/* =========================================================== what the screens say =========================================================== */
{
  // a locked badge: how to unlock it
  eq(line({}, "study-buddy"), { kind: "locked", text: "Share a game with a friend to unlock" }, "locked tile line (the owner's example)");
  eq(line({}, "golden-critic"), { kind: "locked", text: "Write a review from your profile to unlock" }, "locked tile line (the owner's second example)");
  eq(line({}, "flash").text, "Beat your personal best in the 60-second sprint to unlock", "a bracketed example is left out of the tile line");
  eq(line({ shares: 0 }, "game-on").kind, "locked", "nothing earned yet is locked");
  eq(line({ correctAnswers: 6 }, "busy-beaver").kind, "locked", "some progress but no tier earned is still locked");
  // an unlocked badge with a higher tier left: a progress line
  eq(line({ shares: 1 }, "study-buddy"), { kind: "progress", text: "4 more shares to unlock Silver" }, "progress tile line (the owner's example)");
  eq(line({ shares: 4 }, "study-buddy").text, "1 more share to unlock Silver", "one left uses the singular");
  eq(line({ shares: 5 }, "study-buddy").text, "5 more shares to unlock Gold", "after Silver the goal is Gold");
  eq(line({ streak: 3 }, "hot-streak").text, "2 more days to unlock 5-Day Streak", "streak tiers are named by day count");
  eq(line({ sprintBeats: 1 }, "flash").text, "1 more personal best to unlock Silver", "unit with two words, singular");
  // the last tier: max level
  eq(line({ shares: 10 }, "study-buddy"), { kind: "max", text: "Max level reached" }, "last tier: Max level reached");
  eq(line({ reviews: 1 }, "golden-critic"), { kind: "max", text: "Max level reached" }, "a single badge is max level once earned");
  // names and pictures
  const s = fam(ev(snapOf({ shares: 1 }), {}), "study-buddy");
  eq(badgeTitle(s, s.tiers[1]), "Study Buddy – Silver", "badge title with a tier");
  eq(badgeTitle(fam(ev(snapOf({}), {}), "golden-critic"), fam(ev(snapOf({}), {}), "golden-critic").tiers[0]), "Golden Critic", "badge title of a single badge has no tier");
  eq(tierImageAlt(s, s.tiers[0]), "Study Buddy – Bronze badge", "image alt text");
  eq(progressText(s), "1 / 5", "progress text");
  eq(progressText(fam(ev(snapOf({ shares: 10 }), {}), "study-buddy")), "Complete", "progress text when complete");
  // the celebration
  eq(nextGoalText(s, s.tiers[0]), "Next: Silver, 4 more shares", "celebration next goal");
  const jump = fam(ev(snapOf({ shares: 6 }), {}), "study-buddy");
  ok(/already earned/.test(nextGoalText(jump, jump.tiers[0])), "celebration of a tier whose next tier is also earned says so");
  ok(/Max level reached/.test(nextGoalText(fam(ev(snapOf({ shares: 10 }), {}), "study-buddy"), { index: 2 })), "celebration of the last tier says max level");
  // helpers
  eq([singular("days"), singular("classes"), singular("XP"), singular("personal bests"), singular("practice tests"), singular("wins"), singular("")], ["day", "class", "XP", "personal best", "practice test", "win", ""], "singular()");
  eq([initials("Speed of Light"), initials("Game On"), initials("Unstoppable"), initials("XP"), initials("")], ["SL", "GO", "UN", "XP", "?"], "initials()");
  eq([formatCount(5), formatCount(1000), formatCount(2.5)], ["5", "1,000", "2.5"], "formatCount()");
}

if (fails) { console.error(`${fails} badge test(s) failed (${passes} passed)`); process.exit(1); }
console.log(`all badge tests passed (${passes} checks)`);
