import * as S from "./store.js";
import { renderGame, DEFAULT_GAMES } from "./games.js";
import { viewAdmin as adminView } from "./admin.js";
import { viewWorkspace, workspaceLabel } from "./staff.js";
import * as Demo from "./demo.js";
import { challengeBody, enrollBody, mfaCard } from "./mfa.js";
import { $, h, md, clean, ic, toast, shuffle, confetti, symTile, symOf, emojiTile, floatXP, countUp, pic, logo, openModal, firstName } from "./ui.js";
import { buildExtras } from "./classcontent.js";
import { viewProfile, avatarNode, avatarStyle, maybeAskReview } from "./profile.js";
import { viewHelp } from "./support.js";
import { adminCard } from "./admintools.js";
import { viewGlossary } from "./glossary.js";
import * as E from "./editmode.js";
import { shareGame, parseChallenge, gameName, SCORED } from "./share.js";
import { computeNotes, notesCards, daysUntil } from "./notify.js";
import * as Account from "./account.js";
import { TERMS_VERSION, PRIVACY_VERSION, TERMS, PRIVACY, renderLegal } from "./legal.js";
import { onGameEnd } from "./games.js";
import { loadBadgeConfig, evaluateBadges, badgesSection, celebrate } from "./badges.js";

// This page is not meant to be shown inside another site's frame (clickjacking): break out, or stay blank.
if (window.top !== window.self) { document.documentElement.style.display = "none"; try { window.top.location.href = window.self.location.href; } catch {} }

// accessibility options live on this device (text size, easy-read font, reduced motion and appearance)
const A11Y_KEY = "erth209:a11y";
const a11y = () => { try { return JSON.parse(localStorage.getItem(A11Y_KEY)) || {}; } catch { return {}; } };
function applyA11y() {
  const o = a11y(), r = document.documentElement;
  r.dataset.fs = o.fs || "md"; r.dataset.motion = o.motion ? "reduce" : ""; r.dataset.font = o.easy ? "easy" : ""; r.dataset.cb = o.cb ? "1" : ""; r.dataset.eye = o.eye ? "1" : "";
}
function setA11y(patch) { try { localStorage.setItem(A11Y_KEY, JSON.stringify({ ...a11y(), ...patch })); } catch {} applyA11y(); }

const app = $("#app");
let LECS = [];
let SUBJECTS = [];
let MAN = {};                                  // the course lectures' skeletons (content/manifest.json)
let EXTRA = { lectures: [], extra: {}, announcements: [] }; // what instructors added to the person's classes
let builtVersion = -1, builtDrafts = null;
const EXAMS = {};
const CLASS_COLORS = { erth209: "#2F9E94", astr207: "#6F66D6", biol305: "#C8627A" };
const PALETTES = {
  erth209: ["#2F9E94", "#5B7FD6", "#7A6FDB", "#4E9FD0", "#3AA687", "#D9777F", "#3F6FB0", "#CC8A3A", "#6C86B8", "#8E7CC3"],
  astr207: ["#6F66D6", "#4E9FD0", "#2F9E94", "#8E7CC3", "#4A63C9", "#7A6FDB", "#5B8FD6"],
  biol305: ["#C8627A", "#8E7CC3", "#3F7FB8", "#CC8A3A", "#2F9E94", "#D9777F"],
};
let curCls = null; try { curCls = localStorage.getItem("erth209:cls"); } catch {}
const myClasses = () => SUBJECTS.filter((sj) => S.hasAccess(sj.id));
// the class the person opened from Home; with several classes none is assumed (Home is the only place to choose one)
const clsOf = () => { const m = myClasses(); return m.find((x) => x.id === curCls) || (m.length === 1 ? m[0] : null); };
function setCls(id) { curCls = id; try { localStorage.setItem("erth209:cls", id); } catch {} }
const subjOf = (l) => SUBJECTS.find((x) => x.id === l.subject);
const open_ = () => LECS.filter((l) => S.hasAccess(l.subject));

const gamesFor = (x) => [...new Set([...DEFAULT_GAMES, ...(x.games || []), (Array.isArray(x.order) ? x.order.length : x.order) && "order", (Array.isArray(x.sort) ? x.sort.length : x.sort) && "sort", (Array.isArray(x.calc) ? x.calc.length : x.calc) && "calc"].filter(Boolean))];
// a light "skeleton" (ids and counts only) is enough for class and lecture lists and for progress percentages
const skeleton = (m, subject) => ({ id: m.id, title: m.title, chapter: m.chapter, icon: m.icon, subject, sections: m.sections.map((id) => ({ id })), cards: m.cards.map((id) => ({ id })), quiz: m.quiz.map((id) => ({ id })), games: gamesFor(m), _full: false });
// What instructors added to a course lecture is kept apart from the course's own arrays (_base) so it can be rebuilt at any time.
// Lecture lists only need ids and counts until the lecture is opened.
function applyExtras(l) {
  const e = EXTRA.extra[l.id] || { sections: [], cards: [], quiz: [] };
  if (!l._base) l._base = { sections: l.sections, cards: l.cards, quiz: l.quiz };
  const part = (a) => (l._full ? a : a.map((x) => ({ id: x.id })));
  l.sections = [...l._base.sections, ...part(e.sections)]; l.cards = [...l._base.cards, ...part(e.cards)]; l.quiz = [...l._base.quiz, ...part(e.quiz)];
}
const classRows = () => (S.DEMO ? Demo.classRows() : S.classes);
const wantDrafts = () => S.isStaff() && !S.pref("student"); // instructors see their own unpublished items too, marked as drafts
function buildLecs() {
  builtVersion = S.itemsVersion; builtDrafts = wantDrafts();
  EXTRA = buildExtras(S.classItems, classRows(), { showDrafts: builtDrafts, today: new Date().toISOString().slice(0, 10) });
  const keep = new Map(LECS.filter((l) => !l.custom).map((l) => [l.id, l]));
  const base = SUBJECTS.flatMap((sj) => sj.lectures.map((id) => keep.get(id) || (MAN[id] ? skeleton(MAN[id], sj.id) : null))).filter(Boolean);
  const n = {}, color = (l) => { const pal = PALETTES[l.subject] || ["#324586"]; n[l.subject] = n[l.subject] || 0; return pal[n[l.subject]++ % pal.length]; };
  base.forEach((l) => { l.color = color(l); applyExtras(l); });
  EXTRA.lectures.forEach((l) => { l.color = color(l); });
  LECS = [...base, ...EXTRA.lectures];
}
const inflight = {};
const getJson = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
// l._raw is the exact body the lecture was loaded from (the object the database or the published file gave). Admin edit mode changes it and saves it;
// the lists the screens use (l.sections, l.cards, l.quiz) are rebuilt from it. l._orig is the first text of it (the published version, kept for the first save).
function adopt(l, full, fromDb, at) {
  const { subject, color } = l, old = l._raw, text = JSON.stringify(full);
  if (old) for (const k of Object.keys(old)) if (!(k in full) && k !== "id" && k !== "color") delete l[k]; // a part of the lecture an undo took away
  full.sections ||= []; full.cards ||= []; full.quiz ||= [];
  Object.assign(l, full, { subject, color, _full: true }); l.games = gamesFor(full);
  l._raw = full; l._fromDb = fromDb; l._stamp = at || null; l._at = Date.now(); l._snap = text; l._orig ||= text;
  rebuildLecture(l);
}
const rebuildLecture = (l) => { l._base = { sections: l._raw.sections, cards: l._raw.cards, quiz: l._raw.quiz }; applyExtras(l); };
// a lecture is read from the database again when it was loaded more than two minutes ago, so students soon see what an admin changed
const STALE_MS = 120000;
const stale = (l) => !!l._raw && !S.DEMO && navigator.onLine !== false && !l._pending && !l._failed && Date.now() - (l._at || 0) > STALE_MS;
async function loadFull(l) {
  if (l._full && !stale(l)) return;
  inflight[l.id] ||= (async () => {
    if (l._full) { // shown before: only a newer copy from the database counts; offline or on an error the lecture stays as it is
      l._at = Date.now();
      const at = await S.dbLectureAt(l.id); // a tiny question first: the lecture is downloaded again only when it was saved since
      if (at && at !== l._stamp && !l._pending) { const row = await S.dbLectureRow(l.id); if (row && !l._pending) adopt(l, row.body, true, row.at); }
      return;
    }
    // logged-in students read their lectures from the database, where only members of the class can see them;
    // local previews and the first rollout fall back to the published files
    const db = S.DEMO ? null : await S.dbLectureRow(l.id);
    adopt(l, db ? db.body : await getJson("content/" + l.id + ".json"), !!db, db?.at);
  })();
  try { await inflight[l.id]; } finally { delete inflight[l.id]; }
}
const ensureCourse = (cid) => Promise.all([...LECS.filter((l) => l.subject === cid).map(loadFull), loadExams(cid)]);
async function loadExams(sjId) {
  const sj = SUBJECTS.find((x) => x.id === sjId);
  if (!sj?.exams || sjId in EXAMS) return;
  EXAMS[sjId] = null;
  try {
    const e = (S.DEMO ? null : await S.dbExam(sjId)) || (await getJson("content/" + sj.exams + ".json"));
    if (e?.tests?.length) EXAMS[sjId] = e;
  } catch {}
}

async function boot() {
  try { const t = localStorage.getItem("erth209:theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  applyA11y();
  addEventListener("error", (e) => S.reportError(e.message, e.error?.stack));
  addEventListener("unhandledrejection", (e) => S.reportError(e.reason?.message || e.reason, e.reason?.stack));
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  await S.initBackend();
  const [subs, man] = await Promise.all([fetch("content/subjects.json").then((r) => r.json()), fetch("content/manifest.json").then((r) => r.json())]);
  SUBJECTS = subs; MAN = man;
  BADGE_CFG = await loadBadgeConfig();
  SUBJECTS.forEach((sj) => (sj.color = CLASS_COLORS[sj.id] || "#324586"));
  E.setHost({ route, rebuild: rebuildLecture, adopt: (l, body) => adopt(l, body, true), gotoPage: (l, i) => { pageIdx[l.id] = i; } });
  if (S.DEMO) { S.setDemoContent(() => Demo.items(), (p) => Demo.media(p)); await S.loadClassItems(); }
  buildLecs();
  baselineBadges();
  S.onChange(checkMilestones);
  initBars();
  S.setSummaryProvider(classSummaries);
  watchIdle();
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => { if (document.activeElement?.matches("input,select,textarea")) return; if (e.key === "ArrowRight") window.__next?.(); if (e.key === "ArrowLeft") window.__prev?.(); });
  if (S.DEMO && S.isStaff()) Demo.init(LECS);
  route();
  S.pushSummary(true);
  setTimeout(() => maybeAskReview(clsOf()?.id), 3500); // a friendly "how is it going?" a day after the first visit
}

// both bars shrink while the page scrolls down and grow back when it scrolls up (CSS reads data-bars on the root element)
function initBars() {
  const root = document.documentElement; let last = scrollY, ticking = false;
  const update = () => {
    ticking = false; const y = Math.max(0, scrollY), dy = y - last;
    if (y < 24) { root.dataset.bars = ""; last = y; return; }
    const atEnd = y + innerHeight >= root.scrollHeight - 2; // the bounce at the very bottom is not "scrolling up"
    if (dy > 8) { root.dataset.bars = "compact"; last = y; } else if (dy < -8 && !atEnd) { root.dataset.bars = ""; last = y; } else if (Math.abs(dy) > 8) last = y;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
}

// instructors, school managers and admins can see other people's data, so an unattended screen signs them out after 30 minutes
const IDLE_MS = 30 * 60 * 1000;
function watchIdle() {
  let last = Date.now();
  const touch = () => { last = Date.now(); };
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach((ev) => addEventListener(ev, touch, { passive: true, capture: true }));
  const check = async () => {
    if (S.DEMO || !S.session || !S.isStaff() || Date.now() - last < IDLE_MS) return;
    await S.signOut(); location.hash = "#/"; route(); toast("Signed out after 30 minutes without activity.");
  };
  setInterval(check, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
}

// a few numbers per course for the instructor's and school manager's dashboards (the full progress stays private)
function classSummaries() {
  const mine = new Set(S.classes.filter((c) => c.role === "student").map((c) => c.course_id));
  return SUBJECTS.filter((sj) => mine.has(sj.id)).map((sj) => {
    const ls = LECS.filter((l) => l.subject === sj.id), st = ls.map(S.lectureStats), qids = new Set(ls.flatMap((l) => (l.quiz || []).map((q) => q.id)));
    let qa = 0, qc = 0; for (const [id, q] of Object.entries(S.progress().quiz)) if (qids.has(id)) { qa += q.attempts || 0; qc += q.correct || 0; }
    const sum = (k) => st.reduce((t, x) => t + x[k], 0);
    return { course_id: sj.id, pct: ls.length ? Math.round(sum("pct") / ls.length) : 0, mastery: ls.length ? Math.round(ls.reduce((t, l) => t + S.mastery(l), 0) / ls.length) : 0,
      read_topics: sum("read"), cards_known: sum("known"), cards_total: sum("cards"), quiz_attempts: Math.min(qa, 1e6), quiz_correct: Math.min(qc, 1e6) };
  });
}

function gate() {
  if (S.DEMO) return null;
  if (!S.session) return "auth";
  if (!S.profile) return "setup";
  if (S.profile.blocked) return "blocked";
  if (Account.needsTerms(TERMS_VERSION, PRIVACY_VERSION)) return "terms"; // not agreed yet, or the Terms changed since
  if (S.mfaGate) return "mfa";
  return null;
}
let routeSeq = 0;
async function route() {
  const my = ++routeSeq;
  window.__next = window.__prev = null;
  const raw = location.hash.replace(/^#\/?/, ""), [path, qs = ""] = raw.split("?");
  const parts = path.split("/"), query = new URLSearchParams(qs);
  document.documentElement.dataset.bars = ""; // both bars start expanded on every screen
  if (parts[0] !== "play") activeChallenge = null;
  if (parts[0] === "reset") return viewReset();
  if (parts[0] === "privacy") return viewLegal("privacy");
  if (parts[0] === "terms") return viewLegal("terms");
  document.documentElement.style.removeProperty("--c");
  if (parts[0] === "s" && S.hasAccess(parts[1])) setCls(parts[1]);
  if (parts[0] === "l") { const lx = LECS.find((z) => z.id === parts[1]); if (lx && S.hasAccess(lx.subject)) setCls(lx.subject); }
  const g = gate();
  if (parts[0] === "admin" && S.isV2() && !g) { location.replace("#/work"); return; }
  if (g === "auth") return viewAuth();
  if (g === "setup") return authBox("Almost there", h("p", "Your account was created but its profile is missing. The site owner needs to run the latest database patch (supabase/patch1.sql), then press Retry."),
    h(".row", h("button.btn", { onclick: async () => { await S.loadProfile(); route(); } }, "Retry"), h("button.btn.alt", { onclick: async () => { await S.signOut(); route(); } }, "Log out")));
  if (g === "blocked") return viewBlocked();
  if (g === "terms") return viewTermsGate();
  if (g === "mfa") return viewMfa();
  const claimed = S.takeInvitesClaimed(); if (claimed) toast("Your invite was accepted. Your Workspace tab is ready.");
  if (S.takeDeletionCancelled()) toast("Welcome back. Your account deletion was cancelled and your account is restored.", 5000);
  if (builtVersion !== S.itemsVersion || builtDrafts !== wantDrafts()) buildLecs(); // classes or their content changed since the lists were built
  baselineBadges(); // a person who just signed up or logged in has no saved badge baseline yet (it returns at once when there is one)
  // Home is the only place to pick a class: these screens show the class opened from Home and nothing else
  if (["cards", "practice", "progress", "glossary", "search"].includes(parts[0]) && !clsOf()) { toast(myClasses().length ? "Pick a class on Home first." : "Join a class first."); location.hash = "#/"; return; }
  const page = parts[0] || "", need = [];
  if (page === "l" || page === "play") { const lx = LECS.find((z) => z.id === parts[1]); if (lx && S.hasAccess(lx.subject)) need.push(lx); }
  else if (["cards", "practice", "progress", "search", "glossary"].includes(page)) need.push(...pool_());
  else if (page === "admin" && !S.isV2()) need.push(...LECS); // legacy: the older admin screen needs every lecture
  const exSj = page === "s" ? parts[1] : null;
  if (need.some((l) => !l._full || stale(l)) || (exSj && !(exSj in EXAMS))) {
    const t = setTimeout(() => { if (my === routeSeq) app.replaceChildren(h("p.boot", "Loading...")); }, 180);
    try { await Promise.all([...need.map(loadFull), exSj ? loadExams(exSj) : null]); } catch { clearTimeout(t); app.replaceChildren(h("p.boot", "Couldn't load this page. Check your connection and try again.")); return; }
    clearTimeout(t);
    if (my !== routeSeq) return;
  }
  shell(parts, query);
}

/* ---------- shell ---------- */
function shell(parts, query) {
  const page = parts[0] || "";
  const admin = S.isAdmin(), staff = S.isStaff(), v2 = S.isV2();
  const cc = clsOf(), x = S.xp(open_()), first = S.DEMO ? "" : firstName(S.myName());
  if (cc && ["s", "l", "cards", "practice", "progress", "glossary", "search", "play"].includes(page)) document.documentElement.style.setProperty("--c", cc.color); // class colour only inside a class
  app.replaceChildren(
    h("header.top", h(".in",
      h("button.brand", { "aria-label": "ACEIT home", onclick: () => (location.hash = "#/") }, logo(22)),
      h("span.grow"),
      admin && !S.pref("student") ? h("button.chip.editpill" + (S.pref("edit") ? ".on" : ""), { "aria-pressed": String(S.pref("edit")), onclick: () => { S.setPref("edit", !S.pref("edit")); route(); } }, ic("pencil", 14), "Edit") : "",
      h("button.chip.wide-only", { "aria-label": "Search your class", onclick: () => (location.hash = "#/search") }, ic("zoom", 16)),
      h("button.lvl", { "aria-label": `Lv ${x.lvl}, open your profile`, onclick: () => (location.hash = "#/profile") }, "Lv " + x.lvl),
      h("button.me", { onclick: () => (location.hash = "#/profile") }, first ? h("span.nm", first) : "", h("span.avatar", { style: avatarStyle(), "aria-hidden": "true" }, avatarNode(18)), h("span.sr", first ? ", your profile" : "Your profile"),
        S.DEMO ? "" : h("span.syncdot#syncdot", { role: "status", "aria-label": "Sync status" })),
    )),
    h("main.wrap#view"),
    h("nav.nav" + (page === "work" ? ".ws" : ""), { "aria-label": "Main" },
      nav("home", "Home", "", page === "" || page === "l" || page === "s" || page === "play"),
      nav("cards", "Cards", "cards", page === "cards" || page === "glossary"),
      nav("quiz", "Practice", "practice", page === "practice"),
      nav("chart", "Progress", "progress", page === "progress"),
      staff ? (v2 ? nav("users", workspaceLabel(), "work", page === "work") : nav("shield", admin ? "Admin" : "Instructor", "admin", page === "admin")) : "",
    ),
  );
  S.onSync(paintSync); paintSync(S.sync);
  const v = $("#view");
  if (page === "l") return viewLecture(v, parts[1], parts[2] || "notes");
  if (page === "s") return viewSubject(v, parts[1]);
  if (page === "profile") return viewProfile(v, profileCtx());
  if (page === "help") return viewHelp(v, parts[1] || "", { route });
  if (page === "play") return viewPlay(v, parts[1], parts[2], query);
  if (page === "search") return viewSearch(v);
  if (page === "glossary") return viewGlossary(v, { cls: clsOf(), lectures: pool_() });
  if (page === "cards") return viewAllCards(v, parts[1]);
  if (page === "practice") return viewPractice(v);
  if (page === "progress") return viewProgress(v);
  if (page === "work" && staff) return viewWorkspace(v, { LECS, SUBJECTS, EXAMS, route, ensureCourse, refreshExtras: () => S.loadClassItems() }, parts);
  if (page === "admin" && staff) return adminView(v, { LECS, SUBJECTS, route }); // legacy
  viewHome(v);
}
const nav = (icon, label, to, on) => h("button" + (on ? ".on" : ""), { "aria-current": on ? "page" : "false", onclick: () => (location.hash = "#/" + to) }, ic(icon, 22), h("span.lbl", label));
function setTheme(v) {
  if (v === "auto") { delete document.documentElement.dataset.theme; try { localStorage.removeItem("erth209:theme"); } catch {} return; }
  document.documentElement.dataset.theme = v; try { localStorage.setItem("erth209:theme", v); } catch {}
}

/* ---------- search (inside the current class only) ---------- */
function viewSearch(v) {
  const cls = clsOf(), LS = pool_();
  const inp = h("input", { type: "search", placeholder: `Search ${cls ? cls.name : "your class"}: a word, a formula, a topic`, "aria-label": "Search", autocomplete: "off" }), out = h("div");
  const run = () => {
    const q = inp.value.trim().toLowerCase(); out.replaceChildren(); if (q.length < 2) { out.append(h(".src", "Type at least 2 letters.")); return; }
    const cardHits = [], noteHits = [];
    LS.forEach((l) => {
      (l.cards || []).forEach((c) => { if ((c.front + " " + c.back).toLowerCase().includes(q)) cardHits.push({ l, c }); });
      (l.sections || []).forEach((sec, idx) => {
        const text = [sec.title, ...(sec.bullets || []), ...(sec.steps || []).flatMap((st) => [st.title || "", ...(st.bullets || [])])].join(" ");
        if (text.toLowerCase().includes(q)) noteHits.push({ l, sec, idx, snip: snippet(text, q) });
      });
    });
    if (!cardHits.length && !noteHits.length) { out.append(h(".card", "Nothing found. Try a shorter word.")); return; }
    if (noteHits.length) out.append(h("h3", { style: "margin:12px 0 4px" }, `Notes (${noteHits.length})`), ...noteHits.slice(0, 12).map(({ l, sec, idx, snip }) => h("button.ev", { onclick: () => { pageIdx[l.id] = idx; location.hash = `#/l/${l.id}/notes`; } }, h("span.k", l.icon), h("div", { style: "flex:1" }, h("b", clean(sec.title)), h(".src", { style: "margin:0" }, l.title), h("div", md(snip))))));
    if (cardHits.length) out.append(h("h3", { style: "margin:12px 0 4px" }, `Flashcards (${cardHits.length})`), ...cardHits.slice(0, 12).map(({ l, c }) => h(".fb", { style: "margin-top:6px" }, h("b", md(c.front)), h("div", md(c.back)), h(".src", { style: "margin:2px 0 0" }, l.title))));
  };
  inp.oninput = run;
  v.append(h(".hero", h(".ctag", h("i"), cls ? cls.name : ""), h("h1", "Search"), h("p", cls ? `Searching ${cls.name} only.` : "Join a class first.")), inp, out); inp.focus(); run();
}
const snippet = (text, q) => { const t = clean(text), i = t.toLowerCase().indexOf(q); const a = Math.max(0, i - 50); return (a ? "..." : "") + t.slice(a, a + 140).replace(/\*\*/g, "") + (t.length > a + 140 ? "..." : ""); };
// everything the profile screen needs from this file
const profileCtx = () => ({ route, setTheme, a11y, setA11y, lectures: open_, classId: () => clsOf()?.id || null, SUBJECTS, badges: () => badgesNode(), adminCard: () => adminCard({ route, SUBJECTS }) });

/* ---------- sync status ---------- */
function paintSync(st) {
  const el = $("#syncdot"); if (!el) return;
  const msg = { saved: "Saved", syncing: "Saving...", offline: "Offline: changes will sync when you reconnect", error: "Could not save yet: retrying" }[st.state] || "";
  el.className = "syncdot " + st.state; el.title = msg; el.setAttribute("aria-label", msg);
}

/* ---------- auth ---------- */
const linkRow = () => h("span", h("a", { href: "#/terms", target: "_blank", rel: "noopener" }, "Terms of Service"), " and ", h("a", { href: "#/privacy", target: "_blank", rel: "noopener" }, "Privacy Policy"));
// the Terms of Service and the Privacy Policy: public pages (no login needed), so the sign-up screen can open them
function viewLegal(kind) {
  const doc = kind === "terms" ? TERMS : PRIVACY, back = () => { history.length > 1 ? history.back() : (location.hash = "#/"); };
  app.replaceChildren(h("main.auth", { style: "max-width:700px" }, h("button.btn.alt.sm", { onclick: back, style: "margin-bottom:12px" }, ic("left", 16), "Back"), renderLegal(doc),
    h(".legalrow", h("a", { href: kind === "terms" ? "#/privacy" : "#/terms" }, kind === "terms" ? "Privacy Policy" : "Terms of Service"))));
  window.scrollTo(0, 0);
}
// shown to a signed-in person whose agreement is missing or is for older Terms
function viewTermsGate() {
  const before = Account.agreed().terms;
  const agree = h("input", { type: "checkbox", id: "agree2" }), err = h("p.err", { role: "alert" });
  const go = h("button.btn", { disabled: true, style: "width:100%;margin-top:14px" }, "Agree and continue");
  agree.onchange = () => { go.disabled = !agree.checked; };
  go.onclick = async () => { go.disabled = true; const r = await Account.acceptTerms(TERMS_VERSION, PRIVACY_VERSION); if (r.error) { err.textContent = r.error.message; go.disabled = false; return; } route(); };
  authBox(before ? "We updated our terms" : "Before you continue",
    h("p", { style: "margin-top:0" }, before ? "Please read the new Terms of Service and Privacy Policy and agree to keep using Ace It." : "Please read and agree to the Terms of Service and Privacy Policy to use Ace It."),
    h("p", linkRow()), h("label.check", { for: "agree2", style: "align-items:flex-start" }, agree, h("span", "I agree to the Terms of Service and Privacy Policy")), err, go,
    h("button.btn.alt.sm", { style: "margin-top:10px", onclick: async () => { await S.signOut(); location.hash = "#/"; route(); } }, "Log out"));
}
function authBox(title, ...kids) {
  app.replaceChildren(h(".auth", h("h1.authlogo", { "aria-label": "ACEIT" }, logo(46)),
    h("p", { style: "text-align:center;color:var(--mute)" }, "Learn it, play it, ace it."), h(".card", h("h2", title), ...kids), h(".legalrow", h("a", { href: "#/terms" }, "Terms"), h("a", { href: "#/privacy" }, "Privacy"))));
}
function viewAuth() {
  let mode = "in";
  const draw = () => {
    const email = h("input", { type: "email", placeholder: "you@email.com", autocomplete: "email", required: true, id: "em" });
    const pw = h("input", { type: "password", placeholder: mode === "in" ? "Password" : "Password (8+ characters)", autocomplete: mode === "in" ? "current-password" : "new-password", id: "pw" });
    const name = h("input", { placeholder: "Your first name", id: "nm" });
    const err = h("p.err", { role: "alert" });
    const agree = h("input", { type: "checkbox", id: "agree" });
    const go = h("button.btn", { style: "width:100%;margin-top:14px", disabled: mode === "up" }, mode === "in" ? "Log in" : "Sign up");
    agree.onchange = () => { go.disabled = !agree.checked; };
    go.onclick = async () => {
      err.textContent = ""; go.disabled = true;
      if (mode === "up") {
        if (!agree.checked) { err.textContent = "Please agree to the Terms of Service and Privacy Policy."; return; }
        if (pw.value.length < 8) { err.textContent = "Use at least 8 characters for your password."; go.disabled = false; return; }
        const r = await S.signUp(email.value.trim(), pw.value, name.value.trim(), { terms: TERMS_VERSION, privacy: PRIVACY_VERSION });
        if (r.error) err.textContent = r.error.message;
        else if (!r.data.session) { err.style.color = "var(--ok)"; err.textContent = "Check your email to confirm, then log in."; }
        else { await S.loadProfile(); await Account.acceptTerms(TERMS_VERSION, PRIVACY_VERSION); return route(); }
      } else {
        const r = await S.signIn(email.value.trim(), pw.value);
        if (r.error) err.textContent = r.error.message; else return route();
      }
      go.disabled = mode === "up" && !agree.checked;
    };
    const forgot = h("button.btn.alt.sm", { style: "margin-top:10px" }, "Forgot password?");
    forgot.onclick = async () => {
      if (!email.value) { err.textContent = "Type your email above first."; return; }
      const r = await S.forgot(email.value.trim());
      err.style.color = r.error ? "var(--bad)" : "var(--ok)";
      err.textContent = r.error ? r.error.message : "Reset link sent. Check your email.";
    };
    const sw = h("button.btn.alt.sm", { style: "margin:10px 0 0 8px" }, mode === "in" ? "New here? Sign up" : "Have an account? Log in");
    sw.onclick = () => { mode = mode === "in" ? "up" : "in"; draw(); };
    authBox(mode === "in" ? "Log in" : "Create your account",
      mode === "up" ? [h("label", { for: "nm" }, "Name"), name] : "", h("label", { for: "em" }, "Email"), email, h("label", { for: "pw" }, "Password"), pw,
      mode === "up" ? h("label.check", { for: "agree", style: "align-items:flex-start;margin-top:12px" }, agree, h("span", "I agree to the ", h("a", { href: "#/terms", target: "_blank", rel: "noopener" }, "Terms of Service"), " and ", h("a", { href: "#/privacy", target: "_blank", rel: "noopener" }, "Privacy Policy"))) : "",
      err, go, h("div", mode === "in" ? [forgot, sw] : [sw]));
  };
  draw();
}
function viewCode() {
  const code = h("input", { placeholder: "Class access code", autocomplete: "off", "aria-label": "Class access code" });
  const err = h("p.err", { role: "alert" });
  const go = h("button.btn", { style: "width:100%;margin-top:14px" }, "Unlock");
  go.onclick = async () => {
    const r = await S.redeem(code.value.trim());
    if (r.ok) { toast("Welcome!"); confetti(); route(); } else err.textContent = "That code isn't right. Ask Madi.";
  };
  authBox("One more step", h("p", "Enter the class access code to continue."), code, err, go,
    h("button.btn.alt.sm", { style: "margin-top:10px", onclick: async () => { await S.signOut(); route(); } }, "Log out"));
}
// two-step login: the code screen after the password, or a required set-up for staff
function viewMfa() {
  const setup = S.mfaGate === "enroll";
  authBox(setup ? "Set up two-step login" : "Two-step login",
    ...(setup ? [h("p", "Instructors, school managers and admins must use two-step login. Set it up once; it takes about a minute."), enrollBody(() => { route(); S.pushSummary(true); })] : challengeBody(() => { route(); S.pushSummary(true); })),
    h("button.btn.alt.sm", { style: "margin-top:10px", onclick: async () => { await S.signOut(); location.hash = "#/"; route(); } }, "Log out"));
}
function viewBlocked() {
  authBox("Access removed", h("p", "Your access to this site was removed by the admin."),
    h("button.btn.alt.sm", { onclick: async () => { await S.signOut(); route(); } }, "Log out"));
}
function viewReset() {
  const pw = h("input", { type: "password", placeholder: "New password (8+ characters)", autocomplete: "new-password", "aria-label": "New password" });
  const err = h("p.err", { role: "alert" });
  const go = h("button.btn", { style: "width:100%;margin-top:14px" }, "Save new password");
  go.onclick = async () => {
    if (pw.value.length < 8) { err.textContent = "Use at least 8 characters."; return; }
    const r = await S.setNewPassword(pw.value);
    if (r.error) err.textContent = r.error.message; else { toast("Password updated"); location.hash = "#/"; }
  };
  authBox("Choose a new password", pw, err, go);
}

/* ---------- home ---------- */
function ring(pct, color) {
  return h(".ring", { style: `--p:${pct};--c:${color}`, role: "img", "aria-label": pct + " percent complete" }, h("span", pct + "%"));
}
// "Alpha University · ASTR 207 Section 1" for a course the student joined through a class
const classLine = (courseId) => { const k = S.classes.find((c) => c.course_id === courseId && c.role === "student") || S.classes.find((c) => c.course_id === courseId); return k && k.school_name ? `${k.school_name} · ${k.name}` : ""; };
// notes from the instructors of the person's classes (newest first)
function announcementsCard(courseId) {
  const rows = classRows(), list = EXTRA.announcements.filter((a) => !courseId || rows.find((c) => c.class_id === a.classId)?.course_id === courseId).slice(0, 3);
  if (!list.length) return "";
  return h(".card.ann", { style: "margin-bottom:12px;border-left:6px solid var(--sun)" }, h("b", { style: "display:flex;gap:8px;align-items:center" }, ic("bell", 16), list.length === 1 ? "From your instructor" : "From your instructors"),
    list.map((a) => h("div", { style: "margin-top:8px" }, h("b", md(a.title)), a.draft ? h("span.pill.bad", { style: "margin-left:8px" }, "Draft") : "", a.text ? h("p", { style: "margin:2px 0 0" }, md(a.text)) : "",
      h(".src", { style: "margin:2px 0 0" }, [a.by, a.at ? new Date(a.at).toLocaleDateString([], { month: "short", day: "numeric" }) : "", rows.filter((c) => c.role !== "manager").length > 1 ? a.className : ""].filter(Boolean).join(" · ")))));
}
function subjectStats(sj) {
  const ls = LECS.filter((l) => l.subject === sj.id);
  return { n: ls.length, pct: ls.length ? Math.round(ls.reduce((t, l) => t + S.lectureStats(l).pct, 0) / ls.length) : 0 };
}
function joinCard() {
  const inp = h("input", { placeholder: "Enter a class code", autocomplete: "off", "aria-label": "Class code" }), err = h("p.err", { role: "alert", style: "margin:4px 0 0" });
  const go = h("button.btn", { style: "--c:var(--blue)" }, "Join class");
  const submit = async () => {
    const code = inp.value.trim(); if (!code) return; go.disabled = true; err.textContent = "";
    const r = await S.joinByCode(code, SUBJECTS.map((x) => x.id)); go.disabled = false;
    if (!r.ok) { err.textContent = r.message || S.joinProblem[r.reason] || S.joinProblem.error; return; }
    const sj = SUBJECTS.find((x) => x.id === r.cid); setCls(r.cid); toast(`\u{1F389} Joined ${r.name || (sj ? sj.name : "class")}!`); confetti(); route();
  };
  go.onclick = submit; inp.onkeydown = (e) => { if (e.key === "Enter") submit(); };
  return h(".card", { style: "margin-bottom:14px" }, h("h3", "Join a class"), h("p", { style: "margin:0 0 8px;color:var(--mute);font-size:.9rem" }, "Each class has its own code from your instructor."), h(".row.joinrow", { style: "flex-wrap:nowrap" }, inp, go), err);
}
// three small steps for a brand-new student; disappears once done or dismissed
function onboardCard() {
  const pf = S.prefs(); if (S.DEMO || pf.onboarded) return "";
  const done = [myClasses().length > 0, !!pf.avatarSym, Object.keys(S.progress().quiz).length > 0];
  if (done.every(Boolean)) { S.setPrefs({ onboarded: true }); return ""; }
  const step = (ok, t, go) => h(".row", { style: "padding:5px 0;flex-wrap:nowrap" }, h("span", { style: "width:26px;flex:none" }, ok ? "\u2705" : "\u2B1C"), h("span", { style: "flex:1" + (ok ? ";text-decoration:line-through;color:var(--mute)" : "") }, t), !ok && go ? h("button.btn.sm", { onclick: go }, "Do it") : "");
  const cls = clsOf();
  return h(".card", { style: "margin-bottom:14px;border-left:6px solid var(--c)" }, h("h3", "Get started in 3 steps"),
    step(done[0], "Join your class with the code from your instructor", () => document.querySelector("input[aria-label='Class code']")?.focus()),
    step(done[1], "Make your avatar yours", () => (location.hash = "#/profile")),
    step(done[2], "Answer your first question", cls ? () => { const l = LECS.find((z) => z.subject === cls.id); if (l) location.hash = `#/l/${l.id}/quiz`; } : null),
    h(".row", { style: "justify-content:flex-end" }, h("button.btn.alt.sm", { onclick: () => { S.setPrefs({ onboarded: true }); route(); } }, "Hide")));
}
// the exam dates of the person's classes that are still ahead
function dueDates() {
  return myClasses().map((sj) => { const c = S.settings[sj.id]; if (!c?.exam_date) return null; const days = daysUntil(c.exam_date); return days >= 0 ? { sj, name: c.exam_name || "Exam", date: c.exam_date, days } : null; }).filter(Boolean).sort((a, b) => a.days - b.days);
}
const sprintLecOf = (cid) => LECS.find((l) => l.subject === cid && (l.quiz || []).length >= 5)?.id || null;
function noteContext() {
  const day = S.localDay(), stt = S.stats();
  return { name: S.myName(), streak: S.streak(), studiedToday: !!S.progress().days[day], hour: new Date().getHours(), lastGame: stt.lastGame,
    sharedToday: Object.keys(stt.shareDays || {}).some((k) => k.endsWith(":" + day)),
    exams: dueDates().map((e) => ({ cid: e.sj.id, cname: e.sj.name, exam_name: e.name, exam_date: e.date, sprintLec: sprintLecOf(e.sj.id) })),
    dueByClass: myClasses().map((sj) => ({ cid: sj.id, n: S.dueCount(LECS.filter((l) => l.subject === sj.id).flatMap((l) => l.cards || [])) })) };
}
function goNote(n) {
  if (n.cta?.act === "challenge") {
    const lg = S.stats().lastGame, l = lg && LECS.find((x) => x.id === lg.lec);
    if (l) shareGame({ lec: l, game: lg.game, kind: lg.score != null ? "challenge" : "share", score: lg.score, total: lg.total, className: subjOf(l)?.name });
    return;
  }
  if (n.cta?.to) location.hash = n.cta.to;
}
const EMO = { wave: String.fromCodePoint(0x1F44B), fire: String.fromCodePoint(0x1F525), ticket: String.fromCodePoint(0x1F39F, 0xFE0F) };
function viewHome(v) {
  const st = S.streak(), x = S.xp(open_()), lastp = S.last();
  const lastLec = lastp && open_().find((l) => l.id === lastp.lecId);
  const nm = S.DEMO ? "" : firstName(S.myName());
  const mine = SUBJECTS.filter((sj) => S.hasAccess(sj.id)), soon = dueDates();
  v.append(onboardCard());
  v.append(
    h(".hero", h("h1", nm ? `Hi ${nm} ${EMO.wave}` : `Welcome to ACEIT ${EMO.wave}`), h("p", st ? `${EMO.fire} ${st}-day streak. Keep it going.` : "Pick a class below to start a streak today.")),
    ...notesCards(S.DEMO ? [] : computeNotes(noteContext()), { onGo: goNote }),
    h(".card.row", { style: "margin-bottom:14px;justify-content:space-between" },
      h("div", { style: "flex:1;min-width:150px" }, h("b", `Level ${x.lvl}`), h(".bar", { style: "margin:6px 0" }, h("i", { style: `width:${x.pct}%` })), h(".src", h("span", { "data-count": x.xp }, "0"), ` XP. ${x.next - x.xp} more for level ${x.lvl + 1}`)),
      lastLec ? h("button.btn", { style: `--c:${lastLec.color}`, onclick: () => (location.hash = `#/l/${lastLec.id}/${lastp.tab || "notes"}`) }, "Continue: " + lastLec.title, ic("right", 18)) : ""),
    soon.length ? h(".card", { style: "margin-bottom:14px" }, h("h3", { style: "margin-bottom:2px" }, "Coming up"),
      soon.slice(0, 4).map((e) => h("button.soon", { onclick: () => (location.hash = `#/s/${e.sj.id}`) }, ic("calendar", 18), h("span", h("b", e.name), h(".src", { style: "margin:0" }, e.sj.name)),
        h("span.when" + (e.days <= 3 ? ".hot" : ""), e.days === 0 ? "Today" : e.days === 1 ? "Tomorrow" : `In ${e.days} days`)))) : "",
    announcementsCard(null),
    h("h2", "Your classes"),
    mine.length ? "" : h(".card", { style: "margin-bottom:12px" }, h("b", "You haven't joined a class yet"), h("p", { style: "margin:4px 0 0;color:var(--mute)" }, "Enter the class code from your instructor below to get started.")),
    h(".grid", mine.map((sj, i) => {
      const t = subjectStats(sj);
      return h("button.card.lec", { style: `animation-delay:${i * 60}ms;--tc:${sj.color}`, onclick: () => (location.hash = `#/s/${sj.id}`) },
        emojiTile(sj, 52),
        h("div", { style: "flex:1" }, h("b", `${sj.name}: ${sj.title}`), h("small", t.n ? `${t.n} lectures` : "Coming soon"), classLine(sj.id) ? h("small", { style: "display:block" }, classLine(sj.id)) : ""),
        t.n ? ring(t.pct, sj.color) : "");
    })),
    S.DEMO ? "" : h("div", { style: "margin-top:16px" }, joinCard()));
  v.querySelectorAll("[data-count]").forEach((el) => countUp(el, +el.dataset.count));
}

function viewSubject(v, id) {
  const sj = SUBJECTS.find((x) => x.id === id);
  if (!sj) return viewHome(v);
  v.style.setProperty("--c", sj.color);
  v.append(h(".hero", h(".row", { style: "flex-wrap:nowrap" }, emojiTile(sj, 48), h("div", { style: "flex:1" }, h("h1", `${sj.name}: ${sj.title}`), h("p", classLine(sj.id) || "Pick a lecture")))));
  if (!S.hasAccess(sj.id)) {
    const code = h("input", { placeholder: `${sj.name} class code`, autocomplete: "off", "aria-label": `${sj.name} class code` });
    const err = h("p.err", { role: "alert" });
    const go = h("button.btn", { style: "width:100%;margin-top:12px" }, "Unlock " + sj.name);
    const submit = async () => { go.disabled = true; const r = await S.joinByCode(code.value.trim(), SUBJECTS.map((x) => x.id)); go.disabled = false; if (r.ok && r.cid === sj.id) { toast(`${sj.name} unlocked!`); confetti(); route(); } else if (r.ok) { setCls(r.cid); route(); } else err.textContent = r.message || (r.reason === "wrong" ? "That code isn't right for this class. Ask your instructor." : S.joinProblem[r.reason] || S.joinProblem.error); };
    go.onclick = submit; code.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    return v.append(h(".card", h("h2", "Enter the class code"), h("p", { style: "color:var(--mute)" }, `Each class has its own code. Enter the ${sj.name} code to open it.`), code, err, go));
  }
  const ls = LECS.filter((l) => l.subject === sj.id);
  if (!ls.length) return v.append(h(".card", h("h2", "Coming soon"), h("p", "Lectures for this class are being added.")));
  v.append(h(".swipe", h("button.chip", { onclick: () => (location.hash = "#/glossary") }, "Glossary"), h("button.chip", { onclick: () => (location.hash = "#/search") }, ic("zoom", 14), "Search this class")));
  v.append(announcementsCard(sj.id));
  const ex = EXAMS[sj.id];
  const cfg = S.settings[sj.id], days = cfg?.exam_date ? Math.ceil((new Date(cfg.exam_date + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 864e5) : null;
  if (days !== null && days >= 0) {
    const weakest = ls.map((l) => ({ l, m: S.mastery(l) })).sort((a, b) => a.m - b.m).slice(0, 3);
    v.append(h(".card", { style: "margin-bottom:12px;border-left:6px solid var(--sun)" }, h("b", `${cfg.exam_name || "Exam"} ${days === 0 ? "is today" : days === 1 ? "is tomorrow" : `in ${days} days`}`),
      h(".src", { style: "margin:4px 0 6px" }, "Study plan: start with your weakest lectures."),
      h(".row", weakest.map(({ l, m }) => h("button.chip", { style: `--c:${l.color}`, onclick: () => (location.hash = `#/l/${l.id}/quiz`) }, h("span.em", l.icon), `${l.title} (${m}%)`)))));
  }
  const allCards = ls.flatMap((l) => l.cards || []), due = S.dueCount(allCards);
  v.append(h(".card.review", due ? { style: "border-left:6px solid var(--coral)" } : {},
    h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("div", h("b", due ? `${due} card${due === 1 ? "" : "s"} to review today` : "You\'re all caught up"), h(".src", { style: "margin:2px 0 0" }, due ? "Reviewing right on time is the fastest way to remember." : "Cards come back at the best time for your memory.")),
      due ? h("button.btn.sm", { onclick: () => (location.hash = "#/cards/due") }, "Review now") : "")));
  v.append(h(".grid", { style: "margin-top:12px" }, ls.map((l, i) => {
    const s = S.lectureStats(l);
    return h("button.card.lec", { style: `animation-delay:${i * 45}ms;--tc:${l.color}`, onclick: () => (location.hash = `#/l/${l.id}/notes`) },
      emojiTile(l, 52),
      h("div", { style: "flex:1" }, h("b", l.title), h("small", (l.chapter || "") + ` · ${l.sections.length} topics`), l.custom ? h("small", { style: "display:block" }, "Added by your instructor" + (l.draft ? " (draft)" : "")) : "", h(".mastery", { title: "How well you remember this lecture" }, h("i", { style: `width:${S.mastery(l)}%` }), h("span", `Mastery ${S.mastery(l)}%`))),
      ring(s.pct, l.color));
  })));
  if (ex) {
    const run = (t, shuf) => { v.replaceChildren(); const list = shuf ? shuffle(t.questions.slice()) : t.questions.slice(); runQuiz(v, list, t.title, sj.color, () => { v.replaceChildren(); viewSubject(v, id); }); };
    v.append(h("h2", { style: "margin-top:22px" }, "Practice exams"), h("p", { style: "color:var(--mute);margin:0 0 8px" }, ex.intro || "Real exam-style questions. Take them in order like a test, or shuffled."),
      h(".grid", ex.tests.map((t, i) => h(".card", { style: `animation:rise .4s var(--ease) ${i * 50}ms backwards` },
        h(".row", { style: "flex-wrap:nowrap;margin-bottom:6px" }, h(".symtile", { style: `width:44px;height:44px;--tc:${sj.color}` }, "\u{1F4DD}"), h("div", h("b", t.title), h(".src", { style: "margin:0" }, `${t.questions.length} questions`))),
        t.blurb ? h("p", { style: "margin:4px 0 10px;color:var(--mute);font-size:.9rem" }, t.blurb) : "",
        h(".row", h("button.btn.sm", { style: `--c:${sj.color}`, onclick: () => run(t, false) }, "Start in order"), h("button.btn.alt.sm", { onclick: () => run(t, true) }, "Shuffled"))))));
  }
}

const pool_ = () => { const c = clsOf(); return c ? open_().filter((l) => l.subject === c.id) : []; };

/* ---------- lecture ---------- */
const TABS = [["notes", "notes", "Notes"], ["cards", "cards", "Cards"], ["quiz", "quiz", "Quiz"], ["games", "games", "Games"]];
function viewLecture(v, id, tab) {
  const l = LECS.find((x) => x.id === id);
  if (!l) return viewHome(v);
  if (!S.hasAccess(l.subject)) return viewSubject(v, l.subject);
  S.setLast(id, tab);
  const s = S.lectureStats(l);
  v.style.setProperty("--c", l.color);
  v.append(
    h("button.chip", { style: "margin-top:8px", onclick: () => (location.hash = `#/s/${l.subject}`) }, ic("left", 14), subjOf(l)?.name || "Back"),
    h(".hero", { style: "padding-bottom:0" }, h(".row", { style: "flex-wrap:nowrap" }, emojiTile(l, 48), h("div", { style: "flex:1" }, h("h1", l.title), h("p", l.chapter || "")), ring(s.pct, l.color, 52))),
    h(".tabs", TABS.map(([k, icn, t]) => h("button.tab" + (k === tab ? ".on" : ""), { onclick: () => (location.hash = `#/l/${id}/${k}`) }, h("span.em", ic(icn, 20)), t))),
  );
  if (E.editing()) { const tb = E.toolbar(l, tab, { section: () => l.sections[pageIdx[l.id] || 0] }); if (tb) v.append(tb); } // admin edit mode only
  const body = h("div"); v.append(body);
  if (tab === "notes") notes(body, l);
  if (tab === "cards") cards(body, l.cards, l.color, "all", l.id, cardHook([l]));
  if (tab === "quiz") quizMenu(body, l);
  if (tab === "games") renderGame(body, l, LECS);
}

/* ----- notes: one topic per page, arrows to move ----- */
const BOX = { why: ["bulb", "Why it works"], trick: ["brain", "Memory trick"], trap: ["alert", "Exam trap (admin only)"] };
function acc(cls, icon, title, content, open) {
  const body = h(".in", content);
  const el = h(".acc." + cls + (open ? ".open" : ""), h("button", { "aria-expanded": !!open }, h("span.ico", icon), title, h("span.chev", ic("down", 18))), h(".body", h("div", body)));
  el.firstChild.onclick = () => { const o = el.classList.toggle("open"); el.firstChild.setAttribute("aria-expanded", o); };
  return el;
}
function table(t) {
  return h(".tw", h("table", h("thead", h("tr", t.head.map((x) => h("th", md(x))))), h("tbody", t.rows.map((r) => h("tr", r.map((c) => h("td", md(c))))))));
}
function lightbox(im) {
  const lb = h(".lightbox", { onclick: () => lb.remove() }, h("button.chip.x", { "aria-label": "Close" }, ic("x", 18), "Close"), pic(im));
  document.body.append(lb);
}
// One box: a picture and its own explanation. Changing the picture (1/3, 2/3...) changes the text with it.
function stepper(sec, X) {
  const steps = sec.steps?.length ? sec.steps : (sec.images?.length ? sec.images.map((im) => ({ img: im, bullets: [] })) : []);
  if (!steps.length) return "";
  if (X && !sec.steps?.length) X = null; // pictures that are only a list of images (no steps) are not edited
  let i = 0, dir = 1;
  const wrap = h(".stepper");
  const draw = () => {
    const st = steps[i], im = st.img, n = steps.length;
    const go = (d) => { dir = d; i = (i + d + n) % n; draw(); };
    const fig = im ? h(".fig",
      h("button.figbtn", { "aria-label": X ? "Edit picture" : "Enlarge picture", onclick: () => (X ? X.pic(st, draw) : lightbox(im)) }, pic({ ...im, alt: im.alt || sec.title }, { loading: "lazy" }), h("span.zoom", ic(X ? "pencil" : "zoom", 14), X ? "Edit" : "Enlarge")),
      n > 1 ? [h("button.nv.l", { "aria-label": "Previous", onclick: (e) => { e.stopPropagation(); go(-1); } }, ic("left", 18)), h("button.nv.r", { "aria-label": "Next", onclick: (e) => { e.stopPropagation(); go(1); } }, ic("right", 18))] : "",
      n > 1 ? h("span.cnt", `${i + 1} / ${n}`) : "") : X ? X.addPic(st, draw) : "";
    const txt = X ? X.stepText(st, draw, dir < 0) : h(".steptxt" + (dir < 0 ? ".back" : ""),
      st.title ? h("h3", md(st.title)) : "",
      (st.bullets || []).length ? h("ul.pts", st.bullets.map((x) => h("li", md(x)))) : "");
    wrap.replaceChildren(fig,
      im && n > 1 ? h(".dots", { style: "margin:8px 0 2px" }, steps.map((_, k) => h("i" + (k === i ? ".on" : "")))) : "",
      n > 1 && !im ? h(".row", { style: "justify-content:space-between;margin:6px 0" }, h("button.arrow", { "aria-label": "Previous", onclick: () => go(-1) }, ic("left", 20)), h("span.src", `${i + 1} / ${n}`), h("button.arrow", { "aria-label": "Next", onclick: () => go(1) }, ic("right", 20))) : "",
      txt, S.canSeeRefs() && im?.slide ? h(".src.admin", "Slide " + im.slide) : "");
  };
  draw();
  return wrap;
}
const pageIdx = {};
function notes(b, l) {
  const pages = [...l.sections];
  if (!pages.length && !l.table) return b.append(h(".card", { style: "margin-top:10px" }, h("p", { style: "margin:0" }, "There are no notes in this lecture yet.")));
  if (l.table) pages.push({ id: "_glance", title: l.table.title || "At a glance", slides: "", bullets: [], boxes: [], table: l.table, glance: true });
  let i = Math.min(pageIdx[l.id] || 0, pages.length - 1), dir = 1;
  const readSet = () => S.progress().read[l.id] || {};
  const draw = () => {
    pageIdx[l.id] = i;
    const p = pages[i], refs = S.canSeeRefs(), X = E.forPage(l, p, draw); // X: the admin edit mode tools for this topic (null for everyone else)
    const sel = h("select", { "aria-label": "Jump to topic", onchange: (e) => go(+e.target.value) }, pages.map((q, k) => h("option", { value: k, selected: k === i }, `${k + 1}. ${q.title}`)));
    const go = (k, d) => { if (k < 0 || k >= pages.length) return; if (!pages[i].glance && !readSet()[pages[i].id]) floatXP("+3 XP"); if (!pages[i].glance) S.markRead(l.id, pages[i].id); dir = d ?? (k > i ? 1 : -1); i = k; draw(); if (i === pages.length - 1 && pages.every((q) => q.glance || readSet()[q.id])) { confetti(60); } window.scrollTo({ top: 0, behavior: "smooth" }); };
    window.__next = () => go(i + 1); window.__prev = () => go(i - 1);
    const boxes = (p.boxes || []).filter((x) => x.type !== "trap" || refs);
    b.replaceChildren(
      h(".pager", h("button.arrow", { "aria-label": "Previous topic", disabled: i === 0, onclick: () => go(i - 1) }, ic("left", 22)), h(".mid", sel), h("button.arrow", { "aria-label": "Next topic", disabled: i === pages.length - 1, onclick: () => go(i + 1) }, ic("right", 22))),
      h(".dots", pages.map((q, k) => h("i" + (k === i ? ".on" : readSet()[q.id] ? ".done" : "")))),
      h(".card.page" + (dir < 0 ? ".back" : ""),
        h("h2", X ? X.title() : p.title, refs && p.slides ? h("span.refchip", "Slides " + p.slides) : "", p.custom ? h("span.pill.mute", { style: "font-size:.7rem" }, "Your instructor") : "", p.draft ? h("span.pill.bad", { style: "font-size:.7rem" }, "Draft") : ""),
        X && i === 0 ? X.intro() : i === 0 && l.intro ? h("p", { style: "color:var(--mute);margin:0 0 6px" }, md(l.intro)) : "",
        stepper(p, X),
        X ? X.bullets() : (p.bullets || []).length ? h("ul.pts", p.bullets.map((x) => h("li", md(x)))) : "",
        boxes.map((x) => acc(x.type, ic(BOX[x.type][0], 18), BOX[x.type][1], X ? X.box(x) : md(x.text), !!X)),
        p.table ? (p.glance ? table(p.table) : acc("cmp", ic("chart", 18), "Compare table", table(p.table), false)) : "",
        X ? X.pageTools() : "",
        refs && p.sourceNotes ? h(".src.admin", "Source: " + p.sourceNotes.join(" · ")) : "",
      ),
      h(".row", { style: "justify-content:space-between;margin-top:12px" },
        h("button.btn.alt", { disabled: i === 0, onclick: () => go(i - 1) }, ic("left", 18), "Back"),
        i === pages.length - 1 && l.quiz?.length >= 5 ? h("button.btn.alt", { onclick: () => { const qs = shuffle(l.quiz.slice()).slice(0, 5); runQuiz(b, qs, "Quick check", l.color, () => { b.replaceChildren(); notes(b, l); }); } }, "\u26A1 Quick check") : "",
        i === pages.length - 1 ? h("button.btn.ok", { onclick: () => { S.markRead(l.id, pages[i].id); location.hash = `#/l/${l.id}/cards`; } }, "Practice cards", ic("right", 18)) : h("button.btn", { onclick: () => go(i + 1) }, "Next", ic("right", 18))),
    );
  };
  draw();
}

/* ----- flashcards ----- */
// admin edit mode: Edit and Delete under the card being studied (nothing for anyone else)
const cardHook = (LS) => (E.editing() ? (c, redraw) => { const o = LS.find((x) => E.canEdit(x) && x._raw.cards.includes(c)); return o ? E.cardTools(o, c, redraw) : ""; } : null);
export function cards(b, all, color, startMode = "all", deckId = null, edit = null) {
  if (!all.length) return b.append(h(".card", { style: "margin-top:10px" }, h("p", { style: "margin:0" }, "There are no flashcards in this lecture yet.")));
  let deck = startMode === "due" ? S.dueCards(all) : all.slice(), i = 0, mode = startMode === "due" && deck.length ? "due" : "all";
  if (!deck.length) deck = all.slice();
  const draw = () => {
    b.replaceChildren();
    const known = all.filter((c) => S.cardState(c.id) === "know").length;
    // the three card sets are a segmented control (all visible at once); Shuffle and Glossary sit on the progress line
    const sets = [["all", "All cards", () => all.slice()], ["due", `Due today (${S.dueCount(all)})`, () => S.dueCards(all)], ["missed", "Still learning", () => all.filter((c) => S.cardState(c.id) !== "know")]];
    const seg = h(".seg.modes", { role: "group", "aria-label": "Card sets" }, sets.map(([k, t, pick]) => h("button.btn.sm" + (mode === k ? "" : ".alt"), { "aria-pressed": String(mode === k), onclick: () => { mode = k; deck = pick(); i = 0; draw(); } }, t)));
    b.append(seg, h(".bar", { style: `--c:${color};margin-top:10px` }, h("i", { style: `width:${all.length ? (known / all.length) * 100 : 0}%` })),
      h(".row.cardtools", h(".src", `${known} of ${all.length} known`), h(".row", h("button.chip", { onclick: () => { deck = shuffle(deck); i = 0; draw(); } }, ic("refresh", 14), "Shuffle"), h("button.chip", { onclick: () => (location.hash = "#/glossary") }, ic("list", 14), "Glossary"))));
    if (!deck.length) { b.append(h(".card.pop", { style: "margin-top:14px;text-align:center" }, h("h2", "Nothing left here!"), h("p", "You know every card in this set."))); confetti(70); return; }
    if (i >= deck.length) {
      const missed = all.filter((c) => S.cardState(c.id) !== "know");
      if (mode === "all" && deck.length === all.length && deckId) S.mark("decksDone", deckId); // went through the whole deck
      if (!missed.length) confetti();
      b.append(h(".card.pop", { style: "margin-top:14px;text-align:center" }, h("h2", "Round done!"), h("p", `${known} known, ${missed.length} still learning.`),
        missed.length ? h("button.btn", { onclick: () => { mode = "missed"; deck = missed; i = 0; draw(); } }, "Repeat missed cards") : h("p", "Perfect round!")));
      return;
    }
    const c = deck[i];
    const front = h(".face.front", h("span.tag", c.custom ? "Term · your instructor" + (c.draft ? " · draft" : "") : "Term"), h("b", md(c.front)), h(".hint", "Tap to reveal")), back = h(".face.back", { "aria-hidden": "true" }, h("span.tag", "Meaning"), h("div", md(c.back)), S.canSeeRefs() && c.src ? h(".src.admin", c.src) : "");
    const fc = h(".fc", { role: "button", tabindex: 0 }, h(".inner", front, back));
    const flip = () => { const f = fc.classList.toggle("flip"); front.setAttribute("aria-hidden", String(f)); back.setAttribute("aria-hidden", String(!f)); };
    let sx = 0, dx = 0, drag = false, moved = false;
    fc.addEventListener("pointerdown", (e) => { drag = true; moved = false; sx = e.clientX; dx = 0; fc.style.transition = "none"; });
    fc.addEventListener("pointermove", (e) => { if (!drag) return; dx = e.clientX - sx; if (Math.abs(dx) > 10) moved = true; if (moved) { fc.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`; fc.style.opacity = String(1 - Math.min(Math.abs(dx), 220) / 420); } });
    const end = () => { if (!drag) return; drag = false; fc.style.transition = "transform .25s, opacity .25s";
      if (dx > 90) { fc.classList.add("fly-r"); setTimeout(() => mark("know"), 300); }
      else if (dx < -90) { fc.classList.add("fly-l"); setTimeout(() => mark("learning"), 300); }
      else { fc.style.transform = ""; fc.style.opacity = ""; } };
    fc.addEventListener("pointerup", end); fc.addEventListener("pointercancel", end);
    fc.onclick = () => { if (moved) { moved = false; return; } flip(); }; fc.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
    const mark = (v) => { if (v === "know") floatXP("+2 XP"); S.setCard(c.id, v); i++; draw(); };
    window.__next = () => { i = Math.min(i + 1, deck.length); draw(); };
    window.__prev = () => { i = Math.max(i - 1, 0); draw(); };
    b.append(h(".pager", { style: "margin-top:12px" }, h("button.arrow", { "aria-label": "Previous card", disabled: i === 0, onclick: window.__prev }, ic("left", 22)),
      h(".mid.src", { style: "text-align:center;margin:0" }, `Card ${i + 1} of ${deck.length}`), h("button.arrow", { "aria-label": "Next card", onclick: window.__next }, ic("right", 22))),
      fc, h(".swipehint", "Tap to flip. Swipe right if you know it, left if you're still learning."), h(".row", { style: "justify-content:center;margin-top:8px" },
        h("button.btn.warn", { onclick: () => mark("learning") }, "\u{1F615} Still learning"), h("button.btn.ok", { onclick: () => mark("know") }, "\u{1F60E} I know it")), edit ? edit(c, draw) : "");
  };
  draw();
}

/* ----- quiz ----- */
// "how sure were you?" turns every answer into feedback about what the student really knows
function confRow(qid) {
  const row = h(".conf", h("span", "How sure were you?"));
  [["guess", "\u{1F3B2} Guessed"], ["unsure", "\u{1F914} Unsure"], ["sure", "\u{1F4AA} Sure"]].forEach(([k, t]) => row.append(h("button.chip", { onclick: (e) => { S.setConf(qid, k); row.querySelectorAll("button").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); } }, t)));
  return row;
}
function quizMenu(b, l) {
  if (E.canEdit(l)) b.append(E.questionPanel(l)); // admin edit mode: every question with Edit and Delete, and Add question
  const qs = l.quiz;
  if (!qs?.length) return b.append(h(".card", "No questions yet."));
  const pr = S.progress().quiz, wrong = qs.filter((q) => pr[q.id]?.last === false).sort((x, y) => (pr[y.id]?.conf === "sure") - (pr[x.id]?.conf === "sure"));
  const back = () => { b.replaceChildren(); quizMenu(b, l); };
  b.append(h(".card", h("h2", "Quiz: " + l.title), h("p", `${qs.length} questions in exam style. You get instant feedback and an explanation for every answer.`),
    h(".row",
      h("button.btn", { onclick: () => runQuiz(b, shuffle(qs.slice()), l.title, l.color, back) }, "Start quiz"),
      h("button.btn.alt", { disabled: !wrong.length, onclick: () => runQuiz(b, wrong.slice(), "Review mistakes", l.color, back) }, `Review mistakes (${wrong.length})`))));
}
export function runQuiz(b, list, title, color, back, examOpts = {}) {
  let i = 0, score = 0, combo = 0, reported = false; const miss = [];
  const draw = () => {
    b.replaceChildren();
    if (i >= list.length) {
      const pct = score / list.length;
      if (!reported) { // once per run: best score, and a practice test finished before an exam counts as exam preparation
        reported = true; S.quizResult(score, list.length, examOpts.exam ? { title, courseId: examOpts.courseId } : null);
        const cfg = examOpts.exam && examOpts.courseId ? S.settings[examOpts.courseId] : null;
        if (cfg?.exam_date && S.localDay() <= cfg.exam_date && S.mark("examDays", examOpts.courseId + ":" + S.localDay())) S.bump("examPrepped");
      }
      if (pct >= 0.8) confetti(pct === 1 ? 140 : 80);
      b.append(h(".card.pop", { style: "text-align:center;--c:" + color }, h("h2", "" + title + " complete"), h(".score", `${score}/${list.length}`),
        h("p", pct === 1 ? "\u{1F3C6} Perfect score!" : pct >= 0.7 ? "\u{1F4AA} Strong work." : "\u{1F331} Good start. Review the mistakes and try again."),
        miss.length ? h("div", { style: "text-align:left" }, h("h3", "Missed"), miss.map((q) => h(".fb", md(q.q.split("\n")[0]), h(".src", "Answer: " + clean(q.options[q.answer]))))) : "",
        h("button.btn", { style: "margin-top:12px", onclick: back }, "Done")));
      return;
    }
    const q = list[i]; let picked = null;
    const fb = h("div", { "aria-live": "polite" });
    const opts = q.options.map((o, k) => {
      const bt = h("button.opt", h("b", "abcde"[k]), h("span", md(o)));
      bt.onclick = () => {
        if (picked !== null) return; picked = k;
        const ok = k === q.answer; if (ok) { score++; combo++; floatXP(combo >= 3 ? `+4 XP \u{1F525}x${combo}` : "+4 XP"); } else { miss.push(q); combo = 0; }
        S.recordAnswer(q.id, ok);
        fb.append(confRow(q.id));
        opts.forEach((x, j) => { if (j === q.answer) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(h(".fb", h("b", ok ? "\u{1F389} Correct! " : "\u{1F914} Not quite. "), combo >= 3 ? h("span.combo", `\u{1F525} ${combo} in a row! `) : "", md(q.why), S.canSeeRefs() && q.source ? h(".src.admin", "Source: " + q.source) : ""),
          h("button.btn", { style: "margin-top:10px", onclick: () => { i++; draw(); } }, i + 1 === list.length ? "See score" : "Next", ic("right", 18)));
      };
      return bt;
    });
    b.append(h(".src", `${title} · Question ${i + 1} of ${list.length}`), h(".bar", { style: `--c:${color}` }, h("i", { style: `width:${(i / list.length) * 100}%` })),
      h(".card", { style: "margin-top:10px" }, q.custom ? h(".src", { style: "margin:0 0 6px" }, "From your instructor" + (q.draft ? " (draft)" : "")) : "", q.img ? h(".qimg", { role: "button", tabindex: 0, "aria-label": "Enlarge picture", onclick: () => lightbox(q.img) }, pic({ ...q.img, alt: q.img.alt || "Figure for the question" }, { loading: "lazy" })) : "", h(".q", md(q.q)), opts, fb));
  };
  draw();
}

function viewAllCards(v, startMode) {
  const cls = clsOf();
  const draw = () => {
    v.replaceChildren(h(".hero", h(".ctag", h("i"), cls.name), h("h1", "Flashcards"), h("p", "Every lecture mixed together, or tap a lecture to focus on it.")));
    const LS = pool_(), body = h("div"), chips = h(".swipe", { role: "group", "aria-label": "Lectures" });
    const show = (sel) => {
      chips.replaceChildren(h("button.chip" + (!sel ? ".on" : ""), { onclick: () => show(null) }, "All lectures"),
        ...LS.map((l) => h("button.chip" + (sel === l ? ".on" : ""), { onclick: () => show(l) }, [ic(symOf(l), 15), l.title])));
      body.replaceChildren(); cards(body, sel ? sel.cards : shuffle(LS.flatMap((l) => l.cards)), sel ? sel.color : "var(--c)", startMode === "due" && !sel ? "due" : "all", sel ? sel.id : "class:" + cls.id, cardHook(LS));
      requestAnimationFrame(() => chips.querySelector(".on")?.scrollIntoView({ inline: "center", block: "nearest" }));
    };
    v.append(chips, body); show(null);
  };
  draw();
}

function viewPractice(v) {
  const cls = clsOf(); let sel = null;
  const draw = () => {
    const LS = pool_(), all = LS.flatMap((l) => (l.quiz || []).map((q) => ({ ...q, lec: l.id })));
    v.replaceChildren(h(".hero", h(".ctag", h("i"), cls.name), h("h1", "Practice exam"), h("p", "Mixed questions, shuffled like the real thing. Pick lectures or take them all.")));
    const pool = sel ? all.filter((q) => sel.has(q.lec)) : all;
    v.append(h(".swipe", { role: "group", "aria-label": "Lectures" }, h("button.chip" + (!sel ? ".on" : ""), { onclick: () => { sel = null; draw(); } }, "All lectures"),
      ...LS.map((l) => h("button.chip" + (sel?.has(l.id) ? ".on" : ""), { onclick: () => { sel = sel || new Set(); sel.has(l.id) ? sel.delete(l.id) : sel.add(l.id); if (!sel.size) sel = null; draw(); } }, [ic(symOf(l), 15), l.title]))),
      h(".card", h("p", `${pool.length} questions available.`),
        h(".row", [10, 20, 40, pool.length].filter((n, k, a) => n <= pool.length && a.indexOf(n) === k).map((n) =>
          h("button.btn", { style: "--c:var(--blue)", onclick: () => { v.replaceChildren(); runQuiz(v, shuffle(pool.slice()).slice(0, n), "Practice exam", "var(--brand)", draw, { exam: true, courseId: cls.id }); } }, n === pool.length ? `All ${n}` : `${n} questions`)))));
    requestAnimationFrame(() => v.querySelector(".swipe .on")?.scrollIntoView({ inline: "center", block: "nearest" }));
  };
  draw();
}

/* ---------- progress, badges, milestones ---------- */
let BADGE_CFG = null;
// every number the badges are measured by (see badges/README.md)
function badgeSnapshot() {
  const pr = S.progress(), st = S.stats(), LS = open_(), x = S.xp(LS);
  const right = Object.values(pr.quiz).reduce((n, q) => n + (q.correct || 0), 0);
  const tamed = LS.filter((l) => (l.quiz || []).length >= 5 && l.quiz.every((q) => pr.quiz[q.id]?.last === true)).length;
  const conquered = myClasses().filter((sj) => { const ls = LS.filter((l) => l.subject === sj.id); return ls.length > 0 && ls.every((l) => S.lectureStats(l).pct === 100); }).length;
  return { level: x.lvl, xp: x.xp, streak: S.streak(), gamesPlayed: st.gamesPlayed || 0, correctAnswers: right + (st.gameCorrect || 0), sprintBeats: st.sprintBeats || 0, sprintBest: st.sprintBest || 0,
    shares: st.shares || 0, challengesSent: st.challengesSent || 0, challengesWon: st.challengesWon || 0, reviews: st.reviews || 0, quizBest: st.quizBest || 0, quizzes90: st.quizzes90 || 0, quizzes100: st.quizzes100 || 0, cardsReviewed: st.cardsReviewed || 0,
    decksFinished: S.count("decksDone"), glossaryStudied: S.count("glossSeen"), comebacks: st.comebacks || 0, topicsTamed: tamed, classesConquered: conquered,
    nightSessions: S.count("nightDays"), earlySessions: S.count("earlyDays"), examPrepped: st.examPrepped || 0 };
}
// the Badges card of the profile
function badgesNode() {
  if (!BADGE_CFG) return "";
  const snap = badgeSnapshot(), model = evaluateBadges(BADGE_CFG, snap, S.prefs().badgeTiers);
  return h(".card#badges", { style: "margin-top:12px" }, badgesSection(model, snap));
}
// Badges a person already earned before badges existed (or before the badge list changed shape) are saved quietly, so only new ones get a celebration.
// Raise BADGE_SCHEMA when badges/badges.json changes in a way that makes the saved tier counts mean something else (new family ids or tier order).
const BADGE_SCHEMA = 2;
function baselineBadges() {
  if (!BADGE_CFG || !BADGE_CFG.families.length) return; // the list did not load: do not save an empty baseline
  const pf = S.prefs();
  if (pf.badgeTiers != null && pf.badgeSchema === BADGE_SCHEMA) return;
  S.setPrefs({ badgeTiers: evaluateBadges(BADGE_CFG, badgeSnapshot(), {}).saved, badgeSchema: BADGE_SCHEMA, lvl: S.xp(open_()).lvl });
}
let checking = false;
function checkMilestones() {
  if (checking || !BADGE_CFG) return; checking = true;
  try {
    const x = S.xp(open_()), pf = S.prefs();
    if (pf.lvl != null && x.lvl > pf.lvl) { toast(`Level ${x.lvl}! Nice work.`); confetti(110); }
    if (pf.lvl !== x.lvl) S.setPrefs({ lvl: x.lvl });
    if (pf.badgeTiers == null || pf.badgeSchema !== BADGE_SCHEMA) return; // not set up yet (baselineBadges runs at start)
    const model = evaluateBadges(BADGE_CFG, badgeSnapshot(), pf.badgeTiers);
    if (JSON.stringify(model.saved) !== JSON.stringify(pf.badgeTiers)) S.setPrefs({ badgeTiers: model.saved });
    if (model.fresh.length) setTimeout(() => celebrate(model.fresh, model), 700); // a moment after the answer or game that earned it
  } finally { checking = false; }
}
function confBlock(LS) {
  const pr = S.progress().quiz, qs = LS.flatMap((l) => (l.quiz || []).map((q) => ({ l, q, st: pr[q.id] }))).filter((x) => x.st);
  const sure = qs.filter((x) => x.st.conf === "sure"), sureOk = sure.filter((x) => x.st.last).length;
  const trap = qs.filter((x) => x.st.conf === "sure" && x.st.last === false);
  if (!sure.length) return "";
  return h(".card", { style: "margin-top:14px" }, h("h3", "How well you know what you know"),
    h("p", { style: "margin:0 0 6px" }, `When you said "sure", you were right ${Math.round((sureOk / sure.length) * 100)}% of the time.`),
    trap.length ? h("div", h("b", { style: "font-size:.9rem" }, "Sure but wrong: look at these first"), ...trap.slice(0, 5).map((x) => h(".fb", { style: "margin-top:6px" }, h("b", x.l.title + ": "), md(x.q.q.split(String.fromCharCode(10))[0])))) : h(".src", "No overconfident mistakes. Nice calibration."));
}
// the title of the topic a question belongs to (set by the admin in edit mode); "" when there is none
const topicName = (l, id) => { const s = id && (l.sections || []).find((x) => x.id === id); return s ? clean(s.title) : ""; };
// questions answered right less than 60% of the time, grouped by lecture
function weakTopics(LS) {
  const pr = S.progress().quiz;
  return LS.map((l) => ({ l, qs: (l.quiz || []).filter((q) => { const p = pr[q.id]; return p && p.attempts && p.correct / p.attempts < 0.6; }) })).filter((g) => g.qs.length).sort((a, b) => b.qs.length - a.qs.length);
}
function viewProgress(v) {
  const cls = clsOf();
  const draw = () => {
    v.replaceChildren();
    const LS = pool_(), st = S.streak(), x = S.xp(open_());
    const total = LS.length ? Math.round(LS.reduce((s, l) => s + S.lectureStats(l).pct, 0) / LS.length) : 0;
    const weak = weakTopics(LS);
    const weakNodes = weak.length
      ? weak.map(({ l, qs }) => h(".card", { style: `margin-bottom:10px;--c:${l.color}` }, h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("b", l.title), h("span.pill.bad", `${qs.length} weak`)),
        h("div", qs.slice(0, 3).map((q) => h(".fb", { style: "margin-top:6px" }, md(q.q.split("\n")[0]), topicName(l, q.topic) ? h(".src", { style: "margin:2px 0 0" }, "Topic: " + topicName(l, q.topic)) : ""))),
        h("button.btn.sm", { style: "margin-top:10px", onclick: () => { v.replaceChildren(); runQuiz(v, qs.slice(), l.title + ": weak questions", l.color, draw); } }, `Practice these (${qs.length})`)))
      : [h("p", "No weak topics yet. Take a quiz and they'll show up here.")];
    v.append(h(".hero", h(".ctag", h("i"), cls.name), h("h1", "My progress")),
      h(".card.row", ring(total, "var(--brand)", 76), h("div", h("b", "Overall completion"), h("p", { style: "margin:0;color:var(--mute)" }, `Level ${x.lvl} · ${x.xp} XP` + (st ? ` · ${st}-day streak` : "")))),
      h("h2", { style: "margin-top:18px" }, "By lecture"),
      h(".grid", LS.map((l) => { const s = S.lectureStats(l); return h(".card", h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("b", [ic(symOf(l), 15), l.title]), ring(s.pct, l.color, 44)),
        h(".src", `Notes ${s.read}/${s.secs} · Cards ${s.known}/${s.cards} · Quiz ${s.right}/${s.qs}`)); })),
      confBlock(LS),
      h("h2", { style: "margin-top:18px" }, "Weak topics"), h("div", weakNodes));
  };
  draw();
}

/* ---------- shared games and challenges ---------- */
let activeChallenge = null;
function viewPlay(v, lecId, game, query) {
  const l = LECS.find((x) => x.id === lecId), home = h("button.btn", { onclick: () => (location.hash = "#/") }, "Go to Home");
  if (!l || !(l.games || []).includes(game)) return v.append(h(".hero", h("h1", "This game link does not work")), h(".card", h("p", { style: "margin-top:0" }, "The game may have moved or the link may be incomplete."), home));
  if (!S.hasAccess(l.subject)) return v.append(h(".hero", h("h1", "Join the class to play")), h(".card", h("p", { style: "margin-top:0" }, `This game is part of ${subjOf(l)?.name || "a class"}. Enter your class code on Home to join it, then open the link again.`), home));
  setCls(l.subject); v.style.setProperty("--c", l.color);
  const ch = parseChallenge(query), scored = SCORED.includes(game) && ch.score != null;
  activeChallenge = scored ? { ...ch, lec: l.id, game } : null;
  const body = h("div");
  v.append(h("button.chip", { style: "margin-top:8px", onclick: () => (location.hash = `#/l/${l.id}/games`) }, ic("left", 14), l.title),
    ch.by || scored ? h(".card.note", { style: "margin-top:10px" }, h(".grow", h("b", `${ch.by || "A friend"} ${scored ? "challenged you" : "invited you to play"}`), h("p", { style: "margin:2px 0 0" }, scored ? `Beat ${ch.score}/${ch.total} in ${gameName(game)}.` : `${gameName(game)}.`))) : "", body);
  renderGame(body, l, LECS, { start: game, className: subjOf(l)?.name });
}
// after any game: say how a challenge went, and offer to share or challenge
onGameEnd(({ lec, game, score, total, box }) => {
  if (!box) return;
  const scored = SCORED.includes(game) && total > 0, cls = subjOf(lec)?.name, strip = h(".card", { style: "margin-top:12px;text-align:center" });
  const ch = activeChallenge && activeChallenge.lec === lec.id && activeChallenge.game === game && scored ? activeChallenge : null;
  if (ch) {
    const who = ch.by || "your friend", fr = (s, n) => (game === "speed" ? s : s / n), mine = fr(score, total), theirs = fr(ch.score, ch.total); // the sprint counts correct answers, the others the share right
    if (mine > theirs) { if (S.mark("wonLinks", `${lec.id}:${game}:${ch.score}/${ch.total}:${ch.by || ""}`)) S.bump("challengesWon"); strip.append(h("h3", `You beat ${who}!`), h("p", `You scored ${score}/${total}. They scored ${ch.score}/${ch.total}.`)); confetti(); }
    else if (mine === theirs) strip.append(h("h3", "A tie!"), h("p", `You both scored ${ch.score}/${ch.total}. Play again to break it.`));
    else strip.append(h("h3", "So close!"), h("p", `${who} scored ${ch.score}/${ch.total}. You scored ${score}/${total}. Try again.`));
  }
  strip.append(h("button.btn" + (ch ? ".alt" : ""), { onclick: () => shareGame({ lec, game, kind: scored ? "challenge" : "share", score, total, className: cls }) }, ic("send", 16), scored ? "Challenge a friend" : "Share this game"));
  box.append(strip);
});

/* ---------- admin ---------- */
boot().catch((e) => { app.replaceChildren(h("p.boot", "Something went wrong: " + e.message)); console.error(e); });
