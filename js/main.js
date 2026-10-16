import * as S from "./store.js";
import { renderGame } from "./games.js";
import { $, h, md, toast, shuffle } from "./ui.js";

const app = $("#app");
let LECS = [];
let theme = null;

async function boot() {
  try { theme = localStorage.getItem("erth209:theme"); } catch {}
  if (theme) document.documentElement.dataset.theme = theme;
  await S.initBackend();
  const idx = await (await fetch("content/index.json")).json();
  LECS = (await Promise.all(idx.lectures.map((f) => fetch("content/" + f + ".json").then((r) => r.json()))));
  LECS.forEach((l) => (l.cards ||= []));
  window.addEventListener("hashchange", route);
  route();
}

function gate() {
  if (S.DEMO) return null;
  if (!S.session) return "auth";
  if (!S.profile) return "auth";
  if (S.profile.blocked) return "blocked";
  if (!S.profile.access_ok) return "code";
  return null;
}

function route() {
  const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
  const g = gate();
  if (parts[0] === "reset") return viewReset();
  if (g === "auth") return viewAuth();
  if (g === "blocked") return viewBlocked();
  if (g === "code") return viewCode();
  shell(parts);
}

/* ---------- shell ---------- */
function shell(parts) {
  const page = parts[0] || "";
  const isAdmin = S.profile?.is_admin;
  app.replaceChildren(
    h("header.top", h(".in",
      h("button.brand", { onclick: () => (location.hash = "#/") }, "🌍 ERTH 209 Study Hub"),
      h("button.chip", { "aria-label": "Toggle dark mode", onclick: toggleTheme }, "🌓"),
      S.DEMO ? h("span.chip", { title: "No login configured yet" }, "Demo") : h("button.chip", { onclick: async () => { await S.signOut(); route(); } }, "Log out"),
    )),
    h(".wrap#view"),
    h("nav.nav",
      nav("🏠", "Home", "", page === "" || page === "l"),
      nav("🃏", "All cards", "cards", page === "cards"),
      nav("📝", "Practice", "practice", page === "practice"),
      nav("📊", "Progress", "progress", page === "progress"),
      isAdmin ? nav("🛡️", "Admin", "admin", page === "admin") : "",
    ),
  );
  const v = $("#view");
  if (page === "l") return viewLecture(v, parts[1], parts[2] || "notes");
  if (page === "cards") return viewAllCards(v);
  if (page === "practice") return viewPractice(v);
  if (page === "progress") return viewProgress(v);
  if (page === "admin" && isAdmin) return viewAdmin(v);
  viewHome(v);
}
const nav = (ic, label, to, on) => h("button" + (on ? ".on" : ""), { onclick: () => (location.hash = "#/" + to) }, h("i", ic), label);
function toggleTheme() {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const cur = document.documentElement.dataset.theme || (dark ? "dark" : "light");
  const nx = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nx;
  try { localStorage.setItem("erth209:theme", nx); } catch {}
}

/* ---------- auth ---------- */
function authBox(title, ...kids) {
  app.replaceChildren(h(".auth", h("h1", "🌍 ERTH 209 Study Hub"), h(".card", h("h2", title), ...kids)));
}
function viewAuth() {
  let mode = "in";
  const draw = () => {
    const email = h("input", { type: "email", placeholder: "you@email.com", autocomplete: "email", required: true });
    const pw = h("input", { type: "password", placeholder: "Password (6+ characters)", autocomplete: mode === "in" ? "current-password" : "new-password" });
    const name = h("input", { placeholder: "Your first name" });
    const err = h("p.err");
    const go = h("button.btn", { style: "width:100%;margin-top:14px" }, mode === "in" ? "Log in" : "Create account");
    go.onclick = async () => {
      err.textContent = ""; go.disabled = true;
      if (mode === "up") {
        const r = await S.signUp(email.value.trim(), pw.value, name.value.trim());
        if (r.error) err.textContent = r.error.message;
        else if (!r.data.session) { err.style.color = "var(--ok)"; err.textContent = "Check your email to confirm, then log in."; }
        else { await S.loadProfile(); return route(); }
      } else {
        const r = await S.signIn(email.value.trim(), pw.value);
        if (r.error) err.textContent = r.error.message; else return route();
      }
      go.disabled = false;
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
      mode === "up" ? [h("label", "Name"), name] : "", h("label", "Email"), email, h("label", "Password"), pw, err, go,
      h("div", mode === "in" ? [forgot, sw] : [sw]));
  };
  draw();
}
function viewCode() {
  const code = h("input", { placeholder: "Class access code", autocomplete: "off" });
  const err = h("p.err");
  const go = h("button.btn", { style: "width:100%;margin-top:14px" }, "Unlock");
  go.onclick = async () => {
    const r = await S.redeem(code.value.trim());
    if (r.ok) { toast("Welcome! 🎉"); route(); } else err.textContent = "That code isn't right. Ask Madi.";
  };
  authBox("One more step", h("p", "Enter the class access code to continue."), code, err, go,
    h("button.btn.alt.sm", { style: "margin-top:10px", onclick: async () => { await S.signOut(); route(); } }, "Log out"));
}
function viewBlocked() {
  authBox("Access removed", h("p", "Your access to this site was removed by the admin."),
    h("button.btn.alt.sm", { onclick: async () => { await S.signOut(); route(); } }, "Log out"));
}
function viewReset() {
  const pw = h("input", { type: "password", placeholder: "New password (6+ characters)", autocomplete: "new-password" });
  const err = h("p.err");
  const go = h("button.btn", { style: "width:100%;margin-top:14px" }, "Save new password");
  go.onclick = async () => {
    const r = await S.setNewPassword(pw.value);
    if (r.error) err.textContent = r.error.message; else { toast("Password updated"); location.hash = "#/"; }
  };
  authBox("Choose a new password", pw, err, go);
}

/* ---------- home ---------- */
function ring(pct, color, size) {
  return h(".ring", { style: `--p:${pct};--c:${color}` + (size ? `;width:${size}px;height:${size}px` : "") }, h("span", pct + "%"));
}
function viewHome(v) {
  const st = S.streak();
  v.append(
    h(".hero", h("h1", "Pick a lecture"), h("p", `Study one tab at a time. ${st ? "🔥 " + st + "-day streak!" : "Start a streak today."}`)),
    h(".grid", LECS.map((l) => {
      const s = S.lectureStats(l);
      return h("button.card.lec", { onclick: () => (location.hash = `#/l/${l.id}/notes`) },
        h(".ic", { style: `background:${l.color}22` }, l.icon),
        h("div", { style: "flex:1" }, h("b", l.title), h("small", l.chapter || "")),
        ring(s.pct, l.color));
    })),
    h("p", { style: "margin-top:20px;color:var(--mute)" }, "More lectures are being added: Earth's Interior, Plate Tectonics, Minerals, Igneous, Sedimentary, Metamorphism."),
  );
}

/* ---------- lecture ---------- */
const TABS = [["notes", "📖 Notes"], ["cards", "🃏 Flashcards"], ["quiz", "✅ Quiz"], ["games", "🎮 Games"]];
function viewLecture(v, id, tab) {
  const l = LECS.find((x) => x.id === id);
  if (!l) return viewHome(v);
  const s = S.lectureStats(l);
  v.append(
    h(".hero", h(".row", h("span", { style: "font-size:2.2rem" }, l.icon), h("div", { style: "flex:1" }, h("h1", l.title), h("p", l.chapter || "")), ring(s.pct, l.color, 60))),
    h(".tabs", { style: `--c:${l.color}` }, TABS.map(([k, t]) => h("button.tab" + (k === tab ? ".on" : ""), { onclick: () => (location.hash = `#/l/${id}/${k}`) }, t))),
  );
  const body = h("div"); v.append(body);
  if (tab === "notes") notes(body, l);
  if (tab === "cards") cards(body, l.cards, l.color, l.title);
  if (tab === "quiz") quizMenu(body, l.quiz, l.title, l.color);
  if (tab === "games") renderGame(body, l, LECS);
}

function notes(b, l) {
  if (l.intro) b.append(h(".card", md(l.intro)));
  const names = { why: "💡 Why it works", trick: "🧠 Memory trick", trap: "⚠️ Exam trap", note: "📌 Note" };
  (l.sections || []).forEach((s) => {
    const done = S.progress().read[l.id]?.[s.id];
    const btn = h("button.btn.alt.sm.read", done ? "✅ Read" : "Mark as read");
    btn.onclick = () => { S.markRead(l.id, s.id); btn.textContent = "✅ Read"; toast("Nice! Section done"); };
    b.append(h(".sec.card",
      h("h2", s.title, h("span.slidetag", "Slides " + s.slides)),
      h("ul", (s.bullets || []).map((x) => h("li", md(x)))),
      (s.boxes || []).map((x) => h(".box." + x.type, h("span.t", names[x.type] || ""), md(x.text))),
      s.table ? table(s.table) : "",
      s.sourceNotes ? h(".src", "Source: " + s.sourceNotes.join(" · ")) : "", btn));
  });
  if (l.table) b.append(h(".sec", h("h2", "📊 " + l.table.title), table(l.table)));
}
function table(t) {
  return h(".tw", h("table", h("thead", h("tr", t.head.map((x) => h("th", x)))), h("tbody", t.rows.map((r) => h("tr", r.map((c) => h("td", md(c))))))));
}

/* ---------- flashcards ---------- */
export function cards(b, all, color, title) {
  let deck = all.slice(), i = 0, flipped = false, mode = "all";
  const draw = () => {
    b.replaceChildren();
    const known = all.filter((c) => S.cardState(c.id) === "know").length;
    b.append(h(".row", { style: "margin:8px 0" },
      h("button.chip" + (mode === "all" ? ".on" : ""), { onclick: () => { mode = "all"; deck = all.slice(); i = 0; flipped = false; draw(); } }, "All cards"),
      h("button.chip" + (mode === "missed" ? ".on" : ""), { onclick: () => { mode = "missed"; deck = all.filter((c) => S.cardState(c.id) !== "know"); i = 0; flipped = false; draw(); } }, "Still learning"),
      h("button.chip", { onclick: () => { deck = shuffle(deck); i = 0; flipped = false; draw(); } }, "🔀 Shuffle")),
      h(".bar", { style: `--c:${color}` }, h("i", { style: `width:${all.length ? (known / all.length) * 100 : 0}%` })),
      h(".src", `${known} of ${all.length} known`));
    if (!deck.length) { b.append(h(".card", { style: "margin-top:14px;text-align:center" }, h("h2", "🎉 Nothing left here!"), h("p", "You know every card in this set."))); return; }
    if (i >= deck.length) {
      const missed = all.filter((c) => S.cardState(c.id) !== "know");
      b.append(h(".card.pop", { style: "margin-top:14px;text-align:center" }, h("h2", "Round done!"), h("p", `${known} known, ${missed.length} still learning.`),
        missed.length ? h("button.btn", { onclick: () => { mode = "missed"; deck = missed; i = 0; draw(); } }, "Repeat missed cards") : h("p", "🏆 Perfect round!")));
      return;
    }
    const c = deck[i];
    const face = h(".fc" + (flipped ? ".flip" : ""), { style: `--c:${color}` },
      h(".face", { role: "button", tabindex: 0, onclick: () => { flipped = !flipped; face.classList.toggle("flip", flipped); } },
        h("div", flipped ? [md(c.back), c.src ? h(".src", c.src) : ""] : [h("b", md(c.front)), h(".hint", "Tap to flip")])));
    b.append(h(".src", { style: "margin-top:12px" }, `Card ${i + 1} of ${deck.length}`), face,
      h(".row", { style: "justify-content:center" },
        h("button.btn.warn", { onclick: () => { S.setCard(c.id, "learning"); i++; flipped = false; draw(); } }, "😕 Still learning"),
        h("button.btn", { onclick: () => { S.setCard(c.id, "know"); i++; flipped = false; draw(); } }, "✅ Know it")));
  };
  draw();
}

/* ---------- quiz ---------- */
function quizMenu(b, qs, title, color) {
  if (!qs?.length) return b.append(h(".card", "No questions yet."));
  const wrong = qs.filter((q) => S.progress().quiz[q.id]?.last === false);
  b.append(h(".card", h("h2", "Quiz: " + title), h("p", `${qs.length} questions, in your prof's style. Instant feedback with a source for every answer.`),
    h(".row",
      h("button.btn", { onclick: () => runQuiz(b, shuffle(qs.slice()), title, color, () => quizMenu(b.replaceChildren() || b, qs, title, color)) }, "Start quiz"),
      h("button.btn.alt", { disabled: !wrong.length, onclick: () => runQuiz(b, shuffle(wrong.slice()), "Review mistakes", color, () => { b.replaceChildren(); quizMenu(b, qs, title, color); }) }, `Review mistakes (${wrong.length})`))));
}
function runQuiz(b, list, title, color, back) {
  let i = 0, score = 0; const miss = [];
  const draw = () => {
    b.replaceChildren();
    if (i >= list.length) {
      b.append(h(".card.pop", { style: "text-align:center" }, h("h2", title + " complete"), h(".score", `${score}/${list.length}`),
        h("p", score === list.length ? "🏆 Perfect!" : score / list.length >= 0.7 ? "👏 Strong work." : "Keep going. Review the mistakes."),
        miss.length ? h("div", { style: "text-align:left" }, h("h3", "Missed:"), miss.map((q) => h(".fb", md(q.q.split("\n")[0]), h(".src", "Answer: " + q.options[q.answer] + " · " + q.source)))) : "",
        h("button.btn", { style: "margin-top:12px", onclick: back }, "Done")));
      return;
    }
    const q = list[i]; let picked = null;
    const fb = h("div");
    const opts = q.options.map((o, k) => {
      const bt = h("button.opt", h("b", "abcde"[k]), h("span", md(o)));
      bt.onclick = () => {
        if (picked !== null) return; picked = k;
        const ok = k === q.answer; if (ok) score++; else miss.push(q);
        S.recordAnswer(q.id, ok);
        opts.forEach((x, j) => { if (j === q.answer) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(h(".fb", h("b", ok ? "✅ Correct! " : "❌ Not quite. "), md(q.why), h(".src", "Source: " + q.source)),
          h("button.btn", { style: "margin-top:10px", onclick: () => { i++; draw(); } }, i + 1 === list.length ? "See score" : "Next"));
      };
      return bt;
    });
    b.append(h(".src", `${title} · Question ${i + 1} of ${list.length}`), h(".bar", { style: `--c:${color}` }, h("i", { style: `width:${(i / list.length) * 100}%` })),
      h(".card", { style: "margin-top:12px" }, h(".q", md(q.q)), opts, fb));
  };
  draw();
}

function viewAllCards(v) {
  v.append(h(".hero", h("h1", "🃏 Flashcards: all lectures"), h("p", "Mix every lecture, or tap a lecture to focus on it.")));
  const body = h("div");
  const chips = h(".row", { style: "margin:8px 0" });
  const show = (sel) => {
    chips.replaceChildren(h("button.chip" + (!sel ? ".on" : ""), { onclick: () => show(null) }, "All lectures"),
      LECS.map((l) => h("button.chip" + (sel === l ? ".on" : ""), { onclick: () => show(l) }, l.icon + " " + l.title)));
    body.replaceChildren();
    cards(body, sel ? sel.cards : shuffle(LECS.flatMap((l) => l.cards)), sel ? sel.color : "#2f7d6d");
  };
  v.append(chips, body); show(null);
}

function viewPractice(v) {
  const all = LECS.flatMap((l) => (l.quiz || []).map((q) => ({ ...q, lec: l.title })));
  v.append(h(".hero", h("h1", "📝 Practice exam"), h("p", "Mixed questions from every lecture, shuffled like the real thing.")),
    h(".card", h("p", `${all.length} questions available.`),
      h(".row", [10, 20, all.length].filter((n, k, a) => n <= all.length && a.indexOf(n) === k).map((n) =>
        h("button.btn", { onclick: () => { v.replaceChildren(); runQuiz(v, shuffle(all.slice()).slice(0, n), "Practice exam", "#2f7d6d", () => { v.replaceChildren(); viewPractice(v); }); } }, `${n} questions`)))));
}

/* ---------- progress ---------- */
function viewProgress(v) {
  const st = S.streak();
  const total = LECS.length ? Math.round(LECS.reduce((s, l) => s + S.lectureStats(l).pct, 0) / LECS.length) : 0;
  const weak = LECS.flatMap((l) => (l.quiz || []).filter((q) => { const p = S.progress().quiz[q.id]; return p && p.attempts && p.correct / p.attempts < 0.6; }).map((q) => ({ l, q })));
  const badges = [
    ["🔥 3-day streak", st >= 3], ["📖 First section read", Object.keys(S.progress().read).length > 0],
    ["🃏 10 cards known", Object.values(S.progress().cards).filter((x) => x === "know").length >= 10],
    ["✅ 10 questions right", Object.values(S.progress().quiz).filter((x) => x.last).length >= 10],
    ["🎮 First game", Object.keys(S.progress().games).length > 0], ["🏆 Lecture 100%", LECS.some((l) => S.lectureStats(l).pct === 100)],
  ];
  v.append(h(".hero", h("h1", "📊 My progress")),
    h(".card.row", ring(total, "#2f7d6d", 80), h("div", h("b", "Overall completion"), h("p", { style: "margin:0;color:var(--mute)" }, st ? `🔥 ${st}-day streak` : "Study today to start a streak"))),
    h("h2", { style: "margin-top:20px" }, "By lecture"),
    h(".grid", LECS.map((l) => { const s = S.lectureStats(l); return h(".card", h(".row", h("b", l.icon + " " + l.title), ring(s.pct, l.color, 46)),
      h(".src", `Notes ${s.read}/${s.secs} · Cards ${s.known}/${s.cards} · Quiz ${s.right}/${s.qs}`)); })),
    h("h2", { style: "margin-top:20px" }, "🎯 Weak topics"),
    weak.length ? weak.map(({ l, q }) => h(".fb", h("b", l.title + ": "), md(q.q.split("\n")[0]), h(".src", q.source))) : h("p", "No weak topics yet. Take a quiz and they'll show up here."),
    h("h2", { style: "margin-top:20px" }, "🏅 Badges"), h("div", badges.map(([t, on]) => h("span.badge" + (on ? "" : ".lock"), t))));
}

/* ---------- admin ---------- */
async function viewAdmin(v) {
  v.append(h(".hero", h("h1", "🛡️ Admin"), h("p", "Everyone's progress. You can remove anyone.")), h("p", "Loading…"));
  const { profiles, progress, error } = await S.adminList();
  v.lastChild.remove();
  if (error) return v.append(h("p.err", error.message));
  const byId = Object.fromEntries(progress.map((p) => [p.user_id, p]));
  const rows = profiles.map((p) => {
    const d = byId[p.id]?.data || { cards: {}, quiz: {}, read: {}, games: {} };
    const stats = LECS.map((l) => {
      const secs = (l.sections || []).filter((s) => d.read?.[l.id]?.[s.id]).length;
      const known = l.cards.filter((c) => d.cards?.[c.id] === "know").length;
      const right = (l.quiz || []).filter((q) => d.quiz?.[q.id]?.last).length;
      const games = (l.games || []).filter((g) => d.games?.[l.id + ":" + g]).length;
      const parts = [[secs, (l.sections || []).length], [known, l.cards.length], [right, (l.quiz || []).length], [games, (l.games || []).length]].filter((x) => x[1]);
      return Math.round((parts.reduce((s, x) => s + x[0] / x[1], 0) / (parts.length || 1)) * 100);
    });
    const avg = stats.length ? Math.round(stats.reduce((a, b) => a + b, 0) / stats.length) : 0;
    const att = Object.values(d.quiz || {}).reduce((s, x) => s + x.attempts, 0);
    const cor = Object.values(d.quiz || {}).reduce((s, x) => s + x.correct, 0);
    return { p, stats, avg, acc: att ? Math.round((cor / att) * 100) : null, last: byId[p.id]?.updated_at };
  });
  v.append(h(".card", h("b", `${rows.length} accounts`), h(".src", "Class access code is stored in the database. Change it below.")),
    h(".tw", { style: "margin-top:12px" }, h("table", h("thead", h("tr", ["Student", "Overall", ...LECS.map((l) => l.icon), "Quiz acc.", "Last active", ""].map((x) => h("th", x)))),
      h("tbody", rows.map((r) => h("tr",
        h("td", h("b", r.p.display_name || ""), h(".src", r.p.email), r.p.is_admin ? h("span.pill", { style: "background:#2f7d6d" }, "admin") : "", r.p.blocked ? h("span.pill", { style: "background:#c8412f" }, "blocked") : "", !r.p.access_ok && !r.p.is_admin ? h(".src", "no code yet") : ""),
        h("td", r.avg + "%"), ...r.stats.map((x) => h("td", x + "%")),
        h("td", r.acc === null ? "-" : r.acc + "%"), h("td", r.last ? new Date(r.last).toLocaleDateString() : "-"),
        h("td", r.p.is_admin ? "" : h(".row",
          h("button.btn.alt.sm", { onclick: async () => { await S.adminBlock(r.p.id, !r.p.blocked); route(); } }, r.p.blocked ? "Unblock" : "Block"),
          h("button.btn.warn.sm", { onclick: async () => { if (confirm("Permanently remove " + r.p.email + "?")) { const x = await S.adminDelete(r.p.id); if (x.error) toast(x.error.message); route(); } } }, "Kick")))))))),
    h(".card", { style: "margin-top:14px" }, h("h3", "Change class access code"), (() => {
      const inp = h("input", { placeholder: "New code" });
      return h(".row", inp, h("button.btn.sm", { onclick: async () => { if (!inp.value) return; const x = await S.adminCode(inp.value.trim()); toast(x.error ? x.error.message : "Code updated"); } }, "Save"));
    })()));
}

boot().catch((e) => { app.replaceChildren(h("p.boot", "Something went wrong: " + e.message)); console.error(e); });
