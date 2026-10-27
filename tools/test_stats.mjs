// The numbers the badges are measured by (js/store.js): sprint personal best, comebacks, streak days, best quiz score, counters. Run: node tools/test_stats.mjs
// store.js is written for a browser, so the few browser objects it touches are faked first.
const mem = {};
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.location = { hostname: "example.org", search: "", hash: "", pathname: "/", origin: "https://example.org" };
globalThis.addEventListener = () => {};
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error("FAIL:", msg); } };
const S = await import("../js/store.js");

// --- days and streaks use the person's own calendar day, and only studying counts
const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return S.localDay(x); };
ok(/^\d{4}-\d{2}-\d{2}$/.test(S.localDay()), "localDay is YYYY-MM-DD");
ok(S.streak() === 0, "a new account has no streak");
S.setPrefs({ name: "Sam", avatarSym: "gem" });
ok(S.streak() === 0 && !S.progress().days[S.localDay()], "changing the profile is not studying");
S.markRead("lec", "sec1");
ok(S.progress().days[S.localDay()] === 1 && S.streak() === 1, "reading a topic counts as studying today");
const p = S.progress(); p.days[d(1)] = 1; p.days[d(2)] = 1;
ok(S.streak() === 3, "three days in a row make a 3-day streak");
delete p.days[S.localDay()];
ok(S.streak() === 2, "a streak survives until the end of the day it was last kept");
p.days[S.localDay()] = 1; delete p.days[d(1)];
ok(S.streak() === 1, "a missed day breaks the streak");

// --- sprint personal best: the first score sets the baseline, only a higher score beats it
let r = S.gameResult("lec", "speed", 6, 6);
ok(!r.beat && S.stats().sprintBeats === undefined && S.stats().sprintPB.lec === 6, "first sprint sets the personal best without counting as a beat");
r = S.gameResult("lec", "speed", 6, 8); ok(!r.beat, "the same score is not a beat");
r = S.gameResult("lec", "speed", 4, 5); ok(!r.beat && S.stats().sprintPB.lec === 6, "a lower score keeps the personal best");
r = S.gameResult("lec", "speed", 9, 9); ok(r.beat && S.stats().sprintBeats === 1 && S.stats().sprintPB.lec === 9, "6/6 then 9/9 beats the personal best once");
r = S.gameResult("other", "speed", 3, 3); ok(!r.beat && S.stats().sprintPB.other === 3, "each lecture has its own personal best");
r = S.gameResult("lec", "speed", 12, 13); ok(r.beat && S.stats().sprintBeats === 2 && S.stats().sprintBest === 12, "the best sprint overall is remembered");
ok(S.stats().gamesPlayed === 6, "every finished game counts as played");
S.gameResult("lec", "blitz", 8, 10);
ok(S.stats().gameCorrect === 6 + 6 + 4 + 9 + 3 + 12 + 8 && S.stats().lastGame.game === "blitz" && S.stats().lastGame.score === 8, "correct answers in games add up and the last game is remembered");
S.gameResult("lec", "match", 0, 0); ok(S.stats().lastGame.score === null, "a game without a score is remembered without one");

// --- quiz best: only quizzes of at least 5 questions
S.quizResult(3, 3); ok(!S.stats().quizBest && !S.stats().quizzes90 && !S.stats().quizzes100, "a 3-question quiz sets nothing (not the best score, not the 90% and 100% counts)");
S.quizResult(9, 10); ok(S.stats().quizBest === 90 && S.stats().quizzes90 === 1 && !S.stats().quizzes100, "9 of 10 is 90%: one quiz at 90%, none at 100%");
S.quizResult(5, 10); ok(S.stats().quizBest === 90 && S.stats().quizzes90 === 1, "a worse score does not lower the best and is not counted");
S.quizResult(5, 5); ok(S.stats().quizBest === 100 && S.stats().quizzes90 === 2 && S.stats().quizzes100 === 1, "5 of 5 is 100%: counts for Sharpshooter (90%+) and Bullseye (100%)");
S.quizResult(89, 100); ok(S.stats().quizzes90 === 2, "89% is not 90%");
S.quizResult(18, 20); ok(S.stats().quizzes90 === 3 && S.stats().quizzes100 === 1, "18 of 20 is 90%");
S.quizResult(7, 10, { title: "Astronomy practice exam", courseId: "astr207" });
ok(S.stats().practiceExams.length === 1 && S.stats().practiceExams[0].score === 7 && S.stats().practiceExams[0].courseId === "astr207", "practice exam marks are saved with their course and score");
S.quizResult(3, 5);
ok(S.stats().practiceExams.length === 1, "ordinary quizzes do not appear as practice exams");
for (let i = 0; i < 31; i++) S.quizResult(i % 11, 11, { title: "Practice exam", courseId: "astr207" });
ok(S.stats().practiceExams.length === 30, "only the 30 most recent practice exam marks are retained");

// --- a weak question that climbs back above 60% is a comeback
S.recordAnswer("q1", false); S.recordAnswer("q1", false); // 0 of 2: weak
ok(!S.stats().comebacks, "no comeback yet");
S.recordAnswer("q1", true); S.recordAnswer("q1", true); // 2 of 4 = 50%
ok(!S.stats().comebacks, "still weak at 50%");
S.recordAnswer("q1", true); // 3 of 5 = 60%
ok(S.stats().comebacks === 1, "reaching 60% after being weak is a comeback");
S.recordAnswer("q1", true); ok(S.stats().comebacks === 1, "staying strong is not another comeback");
S.recordAnswer("q2", true); S.recordAnswer("q2", true); ok(!S.stats().comebacks || S.stats().comebacks === 1, "a question that was never weak is never a comeback");

// --- flashcards, counters and once-only marks
S.setCard("c1", "know"); S.setCard("c2", "learning"); ok(S.stats().cardsReviewed === 2, "every card mark counts as a review");
ok(S.mark("decksDone", "lec1") === true && S.mark("decksDone", "lec1") === false && S.mark("decksDone", "lec2") === true && S.count("decksDone") === 2, "a deck counts once");
S.bump("shares"); S.bump("shares", 2); ok(S.stats().shares === 3, "bump adds");
ok(S.setMax("quizBest", 50) === false && S.setMax("quizBest", 100) === false && S.setMax("x", 4) === true && S.stats().x === 4, "setMax only goes up");
const h = new Date().getHours(); const night = S.count("nightDays"), early = S.count("earlyDays");
ok((h >= 22 || h < 4) ? night === 1 : (h < 8) ? early === 1 : night === 0 && early === 0, `study time of day is recorded (hour ${h})`);

// --- XP and level
ok(S.xp([]).lvl === 1 && S.xp([]).xp === 0, "no lectures: level 1");
const completionLecture = { id: "completion", sections: [{ id: "s1" }, { id: "s2" }], cards: [{ id: "c1" }, { id: "c2" }], quiz: [{ id: "q1" }, { id: "q2" }], games: ["g1", "g2", "g3"] };
const completionData = { read: { completion: { s1: 1 } }, cards: { c1: "know" }, quiz: { q1: { last: true } }, games: {} };
const completionWithoutGames = S.statsFrom(completionData, completionLecture).pct;
completionData.games["completion:g1"] = 1; completionData.games["completion:g2"] = 1; completionData.games["completion:g3"] = 1;
ok(S.statsFrom(completionData, completionLecture).pct === completionWithoutGames, "playing games does not change lecture completion");
completionData.read.completion.s2 = 1; completionData.cards.c2 = "know"; completionData.quiz.q2 = { last: true };
ok(S.statsFrom(completionData, completionLecture).pct === 100, "reading all topics, knowing all cards, and answering all quiz questions completes a lecture without requiring games");

if (fails) { console.error(fails + " stats check(s) failed"); process.exit(1); }
console.log("all stats checks passed");
process.exit(0);
