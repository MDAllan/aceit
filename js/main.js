import * as S from "./store.js";
import { renderGame, DEFAULT_GAMES } from "./games.js";
import { $, h, md, clean, ic, toast, shuffle, confetti } from "./ui.js";

const app = $("#app");
let LECS = [];

async function boot() {
  try { const t = localStorage.getItem("erth209:theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  await S.initBackend();
  const idx = await (await fetch("content/index.json")).json();
  LECS = await Promise.all(idx.lectures.map((f) => fetch("content/" + f + ".json").then((r) => r.json())));
  LECS.forEach((l) => { l.cards ||= []; l.games = [...new Set([...DEFAULT_GAMES, ...(l.games || [])])]; l.color ||= "#2563eb"; });
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => { if (document.activeElement?.matches("input,select,textarea")) return; if (e.key === "ArrowRight") window.__next?.(); if (e.key === "ArrowLeft") window.__prev?.(); });
  route();
}

function gate() {
  if (S.DEMO) return null;
  if (!S.session) return "auth";
  if (!S.profile) return "setup";
  if (S.profile.blocked) return "blocked";
  if (!S.profile.access_ok) return "code";
  return null;
}
function route() {
  window.__next = window.__prev = null;
  const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
  if (parts[0] === "reset") return viewReset();
  const g = gate();
  if (g === "auth") return viewAuth();
  if (g === "setup") return authBox("Almost there", h("p", "Your account was created but its profile is missing. The site owner needs to run the latest database patch (supabase/patch1.sql), then press Retry."),
    h(".row", h("button.btn", { onclick: async () => { await S.loadProfile(); route(); } }, "Retry"), h("button.btn.alt", { onclick: async () => { await S.signOut(); route(); } }, "Log out")));
  if (g === "blocked") return viewBlocked();
  if (g === "code") return viewCode();
  shell(parts);
}

/* ---------- shell ---------- */
function shell(parts) {
  const page = parts[0] || "";
  const admin = S.isAdmin();
  const x = S.xp(LECS);
  app.replaceChildren(
    h("header.top", h(".in",
      h("button.brand", { onclick: () => (location.hash = "#/") }, h("span.logo", ic("star", 18)), "ERTH 209"),
      h(".xp", { title: `${x.xp} XP` }, ic("fire", 16), "Lv " + x.lvl, h(".bar", h("i", { style: `width:${x.pct}%` }))),
      admin && !S.DEMO ? h("button.chip", { "aria-label": "Switch between admin and student view", onclick: () => { S.setPref("student", !S.pref("student")); route(); } }, ic("eye", 16), S.pref("student") ? "Student view" : "Admin view") : "",
      h("button.chip", { "aria-label": "Toggle dark mode", onclick: toggleTheme }, ic("moon", 16)),
      S.DEMO ? "" : h("button.chip", { "aria-label": "Log out", onclick: async () => { await S.signOut(); route(); } }, ic("logout", 16)),
    )),
    h("main.wrap#view"),
    h("nav.nav", { "aria-label": "Main" },
      nav("home", "Home", "", page === "" || page === "l"),
      nav("cards", "Cards", "cards", page === "cards"),
      nav("quiz", "Practice", "practice", page === "practice"),
      nav("chart", "Progress", "progress", page === "progress"),
      admin ? nav("shield", "Admin", "admin", page === "admin") : "",
    ),
  );
  const v = $("#view");
  if (page === "l") return viewLecture(v, parts[1], parts[2] || "notes");
  if (page === "cards") return viewAllCards(v);
  if (page === "practice") return viewPractice(v);
  if (page === "progress") return viewProgress(v);
  if (page === "admin" && admin) return viewAdmin(v);
  viewHome(v);
}
const nav = (icon, label, to, on) => h("button" + (on ? ".on" : ""), { "aria-current": on ? "page" : "false", onclick: () => (location.hash = "#/" + to) }, ic(icon, 22), label);
function toggleTheme() {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const cur = document.documentElement.dataset.theme || (dark ? "dark" : "light");
  const nx = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nx;
  try { localStorage.setItem("erth209:theme", nx); } catch {}
}

/* ---------- auth ---------- */
function authBox(title, ...kids) {
  app.replaceChildren(h(".auth", h("h1", { style: "text-align:center" }, "ERTH 209 Study Hub"),
    h("p", { style: "text-align:center;color:var(--mute)" }, "Geology made easy. Learn it, play it, ace it."), h(".card", h("h2", title), ...kids)));
}
function viewAuth() {
  let mode = "in";
  const draw = () => {
    const email = h("input", { type: "email", placeholder: "you@email.com", autocomplete: "email", required: true, id: "em" });
    const pw = h("input", { type: "password", placeholder: "Password (6+ characters)", autocomplete: mode === "in" ? "current-password" : "new-password", id: "pw" });
    const name = h("input", { placeholder: "Your first name", id: "nm" });
    const err = h("p.err", { role: "alert" });
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
      mode === "up" ? [h("label", { for: "nm" }, "Name"), name] : "", h("label", { for: "em" }, "Email"), email, h("label", { for: "pw" }, "Password"), pw, err, go,
      h("div", mode === "in" ? [forgot, sw] : [sw]));
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
function viewBlocked() {
  authBox("Access removed", h("p", "Your access to this site was removed by the admin."),
    h("button.btn.alt.sm", { onclick: async () => { await S.signOut(); route(); } }, "Log out"));
}
function viewReset() {
  const pw = h("input", { type: "password", placeholder: "New password (6+ characters)", autocomplete: "new-password", "aria-label": "New password" });
  const err = h("p.err", { role: "alert" });
  const go = h("button.btn", { style: "width:100%;margin-top:14px" }, "Save new password");
  go.onclick = async () => {
    const r = await S.setNewPassword(pw.value);
    if (r.error) err.textContent = r.error.message; else { toast("Password updated"); location.hash = "#/"; }
  };
  authBox("Choose a new password", pw, err, go);
}

/* ---------- home ---------- */
function ring(pct, color, size) {
  return h(".ring", { style: `--p:${pct};--c:${color}` + (size ? `;width:${size}px;height:${size}px` : ""), role: "img", "aria-label": pct + " percent complete" }, h("span", pct + "%"));
}
function viewHome(v) {
  const st = S.streak(), x = S.xp(LECS), lastp = S.last();
  const lastLec = lastp && LECS.find((l) => l.id === lastp.lecId);
  const nm = S.profile?.display_name;
  v.append(
    h(".hero", h("h1", nm ? `Hi ${nm}!` : "Let's learn some geology"), h("p", st ? `${st}-day streak. Keep it going.` : "Pick a lecture and start a streak today.")),
    h(".card.row", { style: "margin-bottom:14px;justify-content:space-between" },
      h("div", { style: "flex:1;min-width:150px" }, h("b", `Level ${x.lvl}`), h(".bar", { style: "margin:6px 0" }, h("i", { style: `width:${x.pct}%` })), h(".src", `${x.xp} XP. ${x.next - x.xp} more for level ${x.lvl + 1}`)),
      lastLec ? h("button.btn", { style: `--c:${lastLec.color}`, onclick: () => (location.hash = `#/l/${lastLec.id}/${lastp.tab || "notes"}`) }, "Continue: " + lastLec.title, ic("right", 18)) : ""),
    h(".grid", LECS.map((l, i) => {
      const s = S.lectureStats(l);
      return h("button.card.lec", { style: `animation-delay:${i * 45}ms`, onclick: () => (location.hash = `#/l/${l.id}/notes`) },
        h(".ic", { style: `background:${l.color}26` }, l.icon),
        h("div", { style: "flex:1" }, h("b", l.title), h("small", (l.chapter || "") + ` · ${l.sections.length} topics`)),
        ring(s.pct, l.color));
    })),
  );
}

/* ---------- lecture ---------- */
const TABS = [["notes", "notes", "Notes"], ["cards", "cards", "Cards"], ["quiz", "quiz", "Quiz"], ["games", "games", "Games"]];
function viewLecture(v, id, tab) {
  const l = LECS.find((x) => x.id === id);
  if (!l) return viewHome(v);
  S.setLast(id, tab);
  const s = S.lectureStats(l);
  v.style.setProperty("--c", l.color);
  v.append(
    h(".hero", { style: "padding-bottom:0" }, h(".row", { style: "flex-wrap:nowrap" }, h("span", { style: "font-size:2rem" }, l.icon), h("div", { style: "flex:1" }, h("h1", l.title), h("p", l.chapter || "")), ring(s.pct, l.color, 52))),
    h(".tabs", TABS.map(([k, icn, t]) => h("button.tab" + (k === tab ? ".on" : ""), { onclick: () => (location.hash = `#/l/${id}/${k}`) }, ic(icn, 20), t))),
  );
  const body = h("div"); v.append(body);
  if (tab === "notes") notes(body, l);
  if (tab === "cards") cards(body, l.cards, l.color);
  if (tab === "quiz") quizMenu(body, l);
  if (tab === "games") renderGame(body, l, LECS);
}

/* ----- notes: one topic per page, arrows to move ----- */
const BOX = { why: ["bulb", "Why it works"], trick: ["brain", "Memory trick"], trap: ["alert", "Exam trap (admin only)"] };
function acc(cls, icon, title, content, open) {
  const body = h(".in", content);
  const el = h(".acc." + cls + (open ? ".open" : ""), h("button", { "aria-expanded": !!open }, h("span.ico", ic(icon, 16)), title, h("span.chev", ic("down", 18))), h(".body", h("div", body)));
  el.firstChild.onclick = () => { const o = el.classList.toggle("open"); el.firstChild.setAttribute("aria-expanded", o); };
  return el;
}
function table(t) {
  return h(".tw", h("table", h("thead", h("tr", t.head.map((x) => h("th", md(x))))), h("tbody", t.rows.map((r) => h("tr", r.map((c) => h("td", md(c))))))));
}
function figs(images) {
  if (!images?.length) return "";
  let i = 0;
  const wrap = h(".figs");
  const draw = () => {
    const im = images[i];
    const fig = h(".fig", { role: "button", tabindex: 0, "aria-label": "Enlarge picture" },
      h("img", { src: im.src, alt: im.alt, loading: "lazy" }),
      h("span.zoom", ic("zoom", 14), "Tap to enlarge"),
      images.length > 1 ? [h("button.nv.l", { "aria-label": "Previous picture", onclick: (e) => { e.stopPropagation(); i = (i - 1 + images.length) % images.length; draw(); } }, ic("left", 18)),
        h("button.nv.r", { "aria-label": "Next picture", onclick: (e) => { e.stopPropagation(); i = (i + 1) % images.length; draw(); } }, ic("right", 18)),
        h("span.cnt", `${i + 1} / ${images.length}`)] : "");
    fig.onclick = () => {
      const lb = h(".lightbox", { onclick: () => lb.remove() }, h("button.chip.x", { "aria-label": "Close" }, ic("x", 18), "Close"), h("img", { src: im.src, alt: im.alt }));
      document.body.append(lb);
    };
    wrap.replaceChildren(fig, S.canSeeRefs() ? h(".src.admin", "Slide " + im.slide) : "");
  };
  draw();
  return wrap;
}
const pageIdx = {};
function notes(b, l) {
  const pages = [...l.sections];
  if (l.table) pages.push({ id: "_glance", title: l.table.title || "At a glance", slides: "", bullets: [], boxes: [], table: l.table, glance: true });
  let i = Math.min(pageIdx[l.id] || 0, pages.length - 1), dir = 1;
  const readSet = () => S.progress().read[l.id] || {};
  const draw = () => {
    pageIdx[l.id] = i;
    const p = pages[i], refs = S.canSeeRefs();
    const sel = h("select", { "aria-label": "Jump to topic", onchange: (e) => go(+e.target.value) }, pages.map((q, k) => h("option", { value: k, selected: k === i }, `${k + 1}. ${q.title}`)));
    const go = (k, d) => { if (k < 0 || k >= pages.length) return; if (!pages[i].glance) S.markRead(l.id, pages[i].id); dir = d ?? (k > i ? 1 : -1); i = k; draw(); if (i === pages.length - 1 && pages.every((q) => q.glance || readSet()[q.id])) { confetti(60); } window.scrollTo({ top: 0, behavior: "smooth" }); };
    window.__next = () => go(i + 1); window.__prev = () => go(i - 1);
    const boxes = (p.boxes || []).filter((x) => x.type !== "trap" || refs);
    b.replaceChildren(
      h(".pager", h("button.arrow", { "aria-label": "Previous topic", disabled: i === 0, onclick: () => go(i - 1) }, ic("left", 22)), h(".mid", sel), h("button.arrow", { "aria-label": "Next topic", disabled: i === pages.length - 1, onclick: () => go(i + 1) }, ic("right", 22))),
      h(".dots", pages.map((q, k) => h("i" + (k === i ? ".on" : readSet()[q.id] ? ".done" : "")))),
      h(".card.page" + (dir < 0 ? ".back" : ""),
        h("h2", p.title, refs && p.slides ? h("span.refchip", "Slides " + p.slides) : ""),
        i === 0 && l.intro ? h("p", { style: "color:var(--mute);margin:0 0 6px" }, md(l.intro)) : "",
        figs(p.images),
        (p.bullets || []).length ? h("ul.pts", p.bullets.map((x) => h("li", md(x)))) : "",
        boxes.map((x) => acc(x.type, BOX[x.type][0], BOX[x.type][1], md(x.text), false)),
        p.table ? (p.glance ? table(p.table) : acc("cmp", "list", "Compare table", table(p.table), false)) : "",
        refs && p.sourceNotes ? h(".src.admin", "Source: " + p.sourceNotes.join(" · ")) : "",
      ),
      h(".row", { style: "justify-content:space-between;margin-top:12px" },
        h("button.btn.alt", { disabled: i === 0, onclick: () => go(i - 1) }, ic("left", 18), "Back"),
        i === pages.length - 1 ? h("button.btn.ok", { onclick: () => { S.markRead(l.id, pages[i].id); location.hash = `#/l/${l.id}/cards`; } }, "Practice cards", ic("right", 18)) : h("button.btn", { onclick: () => go(i + 1) }, "Next", ic("right", 18))),
    );
  };
  draw();
}

/* ----- flashcards ----- */
export function cards(b, all, color) {
  let deck = all.slice(), i = 0, mode = "all";
  const draw = () => {
    b.replaceChildren();
    const known = all.filter((c) => S.cardState(c.id) === "know").length;
    b.append(h(".row", { style: "margin:6px 0" },
      h("button.chip" + (mode === "all" ? ".on" : ""), { onclick: () => { mode = "all"; deck = all.slice(); i = 0; draw(); } }, "All cards"),
      h("button.chip" + (mode === "missed" ? ".on" : ""), { onclick: () => { mode = "missed"; deck = all.filter((c) => S.cardState(c.id) !== "know"); i = 0; draw(); } }, "Still learning"),
      h("button.chip", { onclick: () => { deck = shuffle(deck); i = 0; draw(); } }, "Shuffle")),
      h(".bar", { style: `--c:${color}` }, h("i", { style: `width:${all.length ? (known / all.length) * 100 : 0}%` })),
      h(".src", `${known} of ${all.length} known`));
    if (!deck.length) { b.append(h(".card.pop", { style: "margin-top:14px;text-align:center" }, h("h2", "Nothing left here!"), h("p", "You know every card in this set."))); confetti(70); return; }
    if (i >= deck.length) {
      const missed = all.filter((c) => S.cardState(c.id) !== "know");
      if (!missed.length) confetti();
      b.append(h(".card.pop", { style: "margin-top:14px;text-align:center" }, h("h2", "Round done!"), h("p", `${known} known, ${missed.length} still learning.`),
        missed.length ? h("button.btn", { onclick: () => { mode = "missed"; deck = missed; i = 0; draw(); } }, "Repeat missed cards") : h("p", "Perfect round!")));
      return;
    }
    const c = deck[i];
    const fc = h(".fc", { role: "button", tabindex: 0, "aria-label": "Flip card. Press Enter to reveal the answer." },
      h(".inner",
        h(".face.front", h("span.tag", "Term"), h("b", md(c.front)), h(".hint", "Tap to reveal")),
        h(".face.back", h("span.tag", "Meaning"), h("div", md(c.back)), S.canSeeRefs() && c.src ? h(".src.admin", c.src) : "")));
    const flip = () => fc.classList.toggle("flip");
    fc.onclick = flip; fc.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
    const mark = (v) => { S.setCard(c.id, v); i++; draw(); };
    window.__next = () => { i = Math.min(i + 1, deck.length); draw(); };
    window.__prev = () => { i = Math.max(i - 1, 0); draw(); };
    b.append(h(".pager", { style: "margin-top:12px" }, h("button.arrow", { "aria-label": "Previous card", disabled: i === 0, onclick: window.__prev }, ic("left", 22)),
      h(".mid.src", { style: "text-align:center;margin:0" }, `Card ${i + 1} of ${deck.length}`), h("button.arrow", { "aria-label": "Next card", onclick: window.__next }, ic("right", 22))),
      fc, h(".row", { style: "justify-content:center" },
        h("button.btn.warn", { onclick: () => mark("learning") }, "Still learning"), h("button.btn.ok", { onclick: () => mark("know") }, "I know it")));
  };
  draw();
}

/* ----- quiz ----- */
function quizMenu(b, l) {
  const qs = l.quiz;
  if (!qs?.length) return b.append(h(".card", "No questions yet."));
  const wrong = qs.filter((q) => S.progress().quiz[q.id]?.last === false);
  const back = () => { b.replaceChildren(); quizMenu(b, l); };
  b.append(h(".card", h("h2", "Quiz: " + l.title), h("p", `${qs.length} questions in your prof's style. You get instant feedback and an explanation for every answer.`),
    h(".row",
      h("button.btn", { onclick: () => runQuiz(b, shuffle(qs.slice()), l.title, l.color, back) }, "Start quiz"),
      h("button.btn.alt", { disabled: !wrong.length, onclick: () => runQuiz(b, shuffle(wrong.slice()), "Review mistakes", l.color, back) }, `Review mistakes (${wrong.length})`))));
}
export function runQuiz(b, list, title, color, back) {
  let i = 0, score = 0, combo = 0; const miss = [];
  const draw = () => {
    b.replaceChildren();
    if (i >= list.length) {
      const pct = score / list.length;
      if (pct >= 0.8) confetti(pct === 1 ? 140 : 80);
      b.append(h(".card.pop", { style: "text-align:center;--c:" + color }, h("h2", title + " complete"), h(".score", `${score}/${list.length}`),
        h("p", pct === 1 ? "Perfect score!" : pct >= 0.7 ? "Strong work." : "Good start. Review the mistakes and try again."),
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
        const ok = k === q.answer; if (ok) { score++; combo++; } else { miss.push(q); combo = 0; }
        S.recordAnswer(q.id, ok);
        opts.forEach((x, j) => { if (j === q.answer) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(h(".fb", h("b", ok ? "Correct! " : "Not quite. "), combo >= 3 ? h("span.combo", `${combo} in a row! `) : "", md(q.why), S.canSeeRefs() ? h(".src.admin", "Source: " + q.source) : ""),
          h("button.btn", { style: "margin-top:10px", onclick: () => { i++; draw(); } }, i + 1 === list.length ? "See score" : "Next", ic("right", 18)));
      };
      return bt;
    });
    b.append(h(".src", `${title} · Question ${i + 1} of ${list.length}`), h(".bar", { style: `--c:${color}` }, h("i", { style: `width:${(i / list.length) * 100}%` })),
      h(".card", { style: "margin-top:10px" }, h(".q", md(q.q)), opts, fb));
  };
  draw();
}

function viewAllCards(v) {
  v.append(h(".hero", h("h1", "Flashcards"), h("p", "Mix every lecture, or tap a lecture to focus on it.")));
  const body = h("div"), chips = h(".row", { style: "margin:6px 0" });
  const show = (sel) => {
    chips.replaceChildren(h("button.chip" + (!sel ? ".on" : ""), { onclick: () => show(null) }, "All lectures"),
      LECS.map((l) => h("button.chip" + (sel === l ? ".on" : ""), { onclick: () => show(l) }, l.icon + " " + l.title)));
    body.replaceChildren(); cards(body, sel ? sel.cards : shuffle(LECS.flatMap((l) => l.cards)), sel ? sel.color : "#2563eb");
  };
  v.append(chips, body); show(null);
}

function viewPractice(v) {
  const all = LECS.flatMap((l) => (l.quiz || []).map((q) => ({ ...q, lec: l.id })));
  let sel = null;
  const draw = () => {
    v.replaceChildren(h(".hero", h("h1", "Practice exam"), h("p", "Mixed questions, shuffled like the real thing. Pick lectures or take them all.")));
    const pool = sel ? all.filter((q) => sel.has(q.lec)) : all;
    v.append(h(".row", { style: "margin-bottom:10px" }, h("button.chip" + (!sel ? ".on" : ""), { onclick: () => { sel = null; draw(); } }, "All lectures"),
      LECS.map((l) => h("button.chip" + (sel?.has(l.id) ? ".on" : ""), { onclick: () => { sel = sel || new Set(); sel.has(l.id) ? sel.delete(l.id) : sel.add(l.id); if (!sel.size) sel = null; draw(); } }, l.icon + " " + l.title))),
      h(".card", h("p", `${pool.length} questions available.`),
        h(".row", [10, 20, 40, pool.length].filter((n, k, a) => n <= pool.length && a.indexOf(n) === k).map((n) =>
          h("button.btn", { style: "--c:#2563eb", onclick: () => { v.replaceChildren(); runQuiz(v, shuffle(pool.slice()).slice(0, n), "Practice exam", "#2563eb", draw); } }, n === pool.length ? `All ${n}` : `${n} questions`)))));
  };
  draw();
}

/* ---------- progress ---------- */
function viewProgress(v) {
  const st = S.streak(), x = S.xp(LECS);
  const total = LECS.length ? Math.round(LECS.reduce((s, l) => s + S.lectureStats(l).pct, 0) / LECS.length) : 0;
  const weak = LECS.flatMap((l) => (l.quiz || []).filter((q) => { const p = S.progress().quiz[q.id]; return p && p.attempts && p.correct / p.attempts < 0.6; }).map((q) => ({ l, q })));
  const pr = S.progress();
  const badges = [
    [`3-day streak`, st >= 3, "fire"], ["First topic read", Object.keys(pr.read).length > 0, "notes"],
    ["10 cards known", Object.values(pr.cards).filter((c) => c === "know").length >= 10, "cards"],
    ["10 questions right", Object.values(pr.quiz).filter((c) => c.last).length >= 10, "quiz"],
    ["First game", Object.keys(pr.games).length > 0, "games"], ["Lecture 100%", LECS.some((l) => S.lectureStats(l).pct === 100), "star"],
    ["Level 5", x.lvl >= 5, "star"],
  ];
  v.append(h(".hero", h("h1", "My progress")),
    h(".card.row", ring(total, "#2563eb", 76), h("div", h("b", "Overall completion"), h("p", { style: "margin:0;color:var(--mute)" }, `Level ${x.lvl} · ${x.xp} XP` + (st ? ` · ${st}-day streak` : "")))),
    h("h2", { style: "margin-top:18px" }, "By lecture"),
    h(".grid", LECS.map((l) => { const s = S.lectureStats(l); return h(".card", h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("b", l.icon + " " + l.title), ring(s.pct, l.color, 44)),
      h(".src", `Notes ${s.read}/${s.secs} · Cards ${s.known}/${s.cards} · Quiz ${s.right}/${s.qs}`)); })),
    h("h2", { style: "margin-top:18px" }, "Weak topics"),
    weak.length ? weak.map(({ l, q }) => h(".fb", h("b", l.title + ": "), md(q.q.split("\n")[0]))) : h("p", "No weak topics yet. Take a quiz and they'll show up here."),
    h("h2", { style: "margin-top:18px" }, "Badges"), h("div", badges.map(([t, on, icn]) => h("span.badge" + (on ? "" : ".lock"), ic(icn, 16), t))));
}

/* ---------- admin ---------- */
async function viewAdmin(v) {
  v.append(h(".hero", h("h1", "Admin"), h("p", "Everyone's progress. You can block or remove anyone.")), h("p", "Loading..."));
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
      const games = Math.min((l.games || []).filter((g) => d.games?.[l.id + ":" + g]).length, 3);
      const parts = [[secs, (l.sections || []).length], [known, l.cards.length], [right, (l.quiz || []).length], [games, 3]].filter((x) => x[1]);
      return Math.round((parts.reduce((s, x) => s + x[0] / x[1], 0) / (parts.length || 1)) * 100);
    });
    const avg = stats.length ? Math.round(stats.reduce((a, c) => a + c, 0) / stats.length) : 0;
    const att = Object.values(d.quiz || {}).reduce((s, x) => s + x.attempts, 0), cor = Object.values(d.quiz || {}).reduce((s, x) => s + x.correct, 0);
    return { p, stats, avg, acc: att ? Math.round((cor / att) * 100) : null, last: byId[p.id]?.updated_at };
  });
  v.append(h(".card", h("b", `${rows.length} accounts`), h(".src", "Columns are each lecture's completion. The class access code can be changed below.")),
    h(".tw", { style: "margin-top:12px" }, h("table", h("thead", h("tr", ["Student", "Overall", ...LECS.map((l) => l.icon), "Quiz acc.", "Last active", ""].map((x) => h("th", x)))),
      h("tbody", rows.map((r) => h("tr",
        h("td", h("b", r.p.display_name || ""), h(".src", r.p.email), r.p.is_admin ? h("span.pill", { style: "background:#2563eb" }, "admin") : "", r.p.blocked ? h("span.pill", { style: "background:#dc2626" }, "blocked") : "", !r.p.access_ok && !r.p.is_admin ? h(".src", "no code yet") : ""),
        h("td", r.avg + "%"), ...r.stats.map((x) => h("td", x + "%")),
        h("td", r.acc === null ? "-" : r.acc + "%"), h("td", r.last ? new Date(r.last).toLocaleDateString() : "-"),
        h("td", r.p.is_admin ? "" : h(".row", { style: "flex-wrap:nowrap" },
          h("button.btn.alt.sm", { onclick: async () => { await S.adminBlock(r.p.id, !r.p.blocked); route(); } }, r.p.blocked ? "Unblock" : "Block"),
          h("button.btn.warn.sm", { onclick: async () => { if (confirm("Permanently remove " + r.p.email + "?")) { const x = await S.adminDelete(r.p.id); if (x.error) toast(x.error.message); route(); } } }, "Kick")))))))),
    h(".card", { style: "margin-top:14px" }, h("h3", "Change class access code"), (() => {
      const inp = h("input", { placeholder: "New code", "aria-label": "New access code" });
      return h(".row", { style: "flex-wrap:nowrap" }, inp, h("button.btn.sm", { onclick: async () => { if (!inp.value) return; const x = await S.adminCode(inp.value.trim()); toast(x.error ? x.error.message : "Code updated"); } }, "Save"));
    })()));
}

boot().catch((e) => { app.replaceChildren(h("p.boot", "Something went wrong: " + e.message)); console.error(e); });
