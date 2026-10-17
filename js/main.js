import * as S from "./store.js";
import { renderGame, DEFAULT_GAMES } from "./games.js";
import { $, h, md, clean, ic, toast, shuffle, confetti, symTile, symOf } from "./ui.js";

const app = $("#app");
let LECS = [];
let SUBJECTS = [];
const EXAMS = {};
const subjOf = (l) => SUBJECTS.find((x) => x.id === l.subject);
const open_ = () => LECS.filter((l) => S.hasAccess(l.subject));

async function boot() {
  try { const t = localStorage.getItem("erth209:theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  await S.initBackend();
  SUBJECTS = await (await fetch("content/subjects.json")).json();
  LECS = (await Promise.all(SUBJECTS.flatMap((sj) => sj.lectures.map((f) => fetch("content/" + f + ".json").then((r) => r.json()).then((l) => ({ ...l, subject: sj.id })))))).filter(Boolean);
  await Promise.all(SUBJECTS.filter((sj) => sj.exams).map((sj) => fetch("content/" + sj.exams + ".json").then((r) => (r.ok ? r.json() : null)).then((e) => { if (e?.tests?.length) EXAMS[sj.id] = e; }).catch(() => {})));
  LECS.forEach((l) => { l.cards ||= []; l.games = [...new Set([...DEFAULT_GAMES, ...(l.games || []), l.order?.length && "order", l.sort?.length && "sort", l.calc?.length && "calc"].filter(Boolean))]; l.color ||= "#2563eb"; });
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => { if (document.activeElement?.matches("input,select,textarea")) return; if (e.key === "ArrowRight") window.__next?.(); if (e.key === "ArrowLeft") window.__prev?.(); });
  route();
}

function gate() {
  if (S.DEMO) return null;
  if (!S.session) return "auth";
  if (!S.profile) return "setup";
  if (S.profile.blocked) return "blocked";
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
  shell(parts);
}

/* ---------- shell ---------- */
function shell(parts) {
  const page = parts[0] || "";
  const admin = S.isAdmin();
  const x = S.xp(LECS);
  app.replaceChildren(
    h("header.top", h(".in",
      h("button.brand", { onclick: () => (location.hash = "#/") }, h("span.logo", ic("star", 18)), "ACEIT"),
      h(".xp", { title: `${x.xp} XP` }, ic("fire", 16), "Lv " + x.lvl, h(".bar", h("i", { style: `width:${x.pct}%` }))),
      admin && !S.DEMO ? h("button.chip", { "aria-label": "Switch between admin and student view", onclick: () => { S.setPref("student", !S.pref("student")); route(); } }, ic("eye", 16), S.pref("student") ? "Student view" : "Admin view") : "",
      h("button.chip", { "aria-label": "Toggle dark mode", onclick: toggleTheme }, ic("moon", 16)),
      S.DEMO ? "" : h("button.chip", { "aria-label": "Log out", onclick: async () => { await S.signOut(); route(); } }, ic("logout", 16)),
    )),
    h("main.wrap#view"),
    h("nav.nav", { "aria-label": "Main" },
      nav("home", "Classes", "", page === "" || page === "l" || page === "s"),
      nav("cards", "Cards", "cards", page === "cards"),
      nav("quiz", "Practice", "practice", page === "practice"),
      nav("chart", "Progress", "progress", page === "progress"),
      admin ? nav("shield", "Admin", "admin", page === "admin") : "",
    ),
  );
  const v = $("#view");
  if (page === "l") return viewLecture(v, parts[1], parts[2] || "notes");
  if (page === "s") return viewSubject(v, parts[1]);
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
  app.replaceChildren(h(".auth", h("h1", { style: "text-align:center" }, "ACEIT"),
    h("p", { style: "text-align:center;color:var(--mute)" }, "Learn it, play it, ace it."), h(".card", h("h2", title), ...kids)));
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
function subjectStats(sj) {
  const ls = LECS.filter((l) => l.subject === sj.id);
  return { n: ls.length, pct: ls.length ? Math.round(ls.reduce((t, l) => t + S.lectureStats(l).pct, 0) / ls.length) : 0 };
}
function joinCard() {
  const inp = h("input", { placeholder: "Enter a class code", autocomplete: "off", "aria-label": "Class code" }), err = h("p.err", { role: "alert", style: "margin:4px 0 0" });
  const go = h("button.btn", { style: "--c:#2563eb" }, "Join class");
  const submit = async () => {
    const code = inp.value.trim(); if (!code) return; go.disabled = true; err.textContent = "";
    const cid = await S.joinByCode(code, SUBJECTS.map((x) => x.id)); go.disabled = false;
    if (cid) { const sj = SUBJECTS.find((x) => x.id === cid); toast(`Joined ${sj ? sj.name : "class"}!`); confetti(); route(); } else err.textContent = "That code doesn't match any class. Check it and try again.";
  };
  go.onclick = submit; inp.onkeydown = (e) => { if (e.key === "Enter") submit(); };
  return h(".card", { style: "margin-bottom:14px" }, h("h3", "Join a class"), h("p", { style: "margin:0 0 8px;color:var(--mute);font-size:.9rem" }, "Each class has its own code from your instructor."), h(".row", { style: "flex-wrap:nowrap" }, inp, go), err);
}
function viewHome(v) {
  const st = S.streak(), x = S.xp(open_()), lastp = S.last();
  const lastLec = lastp && open_().find((l) => l.id === lastp.lecId);
  const nm = S.profile?.display_name;
  v.append(
    h(".hero", h("h1", nm ? `Hi ${nm}!` : "Welcome to ACEIT"), h("p", st ? `${st}-day streak. Keep it going.` : "Pick a class and start a streak today.")),
    h(".card.row", { style: "margin-bottom:14px;justify-content:space-between" },
      h("div", { style: "flex:1;min-width:150px" }, h("b", `Level ${x.lvl}`), h(".bar", { style: "margin:6px 0" }, h("i", { style: `width:${x.pct}%` })), h(".src", `${x.xp} XP. ${x.next - x.xp} more for level ${x.lvl + 1}`)),
      lastLec ? h("button.btn", { style: `--c:${lastLec.color}`, onclick: () => (location.hash = `#/l/${lastLec.id}/${lastp.tab || "notes"}`) }, "Continue: " + lastLec.title, ic("right", 18)) : ""),
    S.DEMO ? "" : joinCard(),
    h("h2", { style: "margin-top:6px" }, "Your classes"),
    h(".grid", SUBJECTS.map((sj, i) => {
      const unlocked = S.hasAccess(sj.id), t = subjectStats(sj);
      return h("button.card.lec", { style: `animation-delay:${i * 60}ms`, onclick: () => (location.hash = `#/s/${sj.id}`) },
        symTile(sj, 52),
        h("div", { style: "flex:1" }, h("b", `${sj.name}: ${sj.title}`), h("small", unlocked ? (t.n ? `${t.n} lectures` : "Coming soon") : "Locked. Tap to enter the class code")),
        unlocked ? (t.n ? ring(t.pct, sj.color) : "") : h("span.pill", { style: "background:#64748b" }, "Locked"));
    })));
}

function viewSubject(v, id) {
  const sj = SUBJECTS.find((x) => x.id === id);
  if (!sj) return viewHome(v);
  v.style.setProperty("--c", sj.color);
  v.append(h(".hero", h(".row", { style: "flex-wrap:nowrap" }, symTile(sj, 48), h("div", { style: "flex:1" }, h("h1", `${sj.name}: ${sj.title}`), h("p", "Pick a lecture")))));
  if (!S.hasAccess(sj.id)) {
    const code = h("input", { placeholder: `${sj.name} class code`, autocomplete: "off", "aria-label": `${sj.name} class code` });
    const err = h("p.err", { role: "alert" });
    const go = h("button.btn", { style: "width:100%;margin-top:12px" }, "Unlock " + sj.name);
    const submit = async () => { go.disabled = true; const r = await S.redeemClass(sj.id, code.value.trim()); go.disabled = false; if (r.ok) { toast(`${sj.name} unlocked!`); confetti(); route(); } else err.textContent = "That code isn't right for this class. Ask Madi."; };
    go.onclick = submit; code.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    return v.append(h(".card", h("h2", "Enter the class code"), h("p", { style: "color:var(--mute)" }, `Each class has its own code. Enter the ${sj.name} code to open it.`), code, err, go));
  }
  const ls = LECS.filter((l) => l.subject === sj.id);
  if (!ls.length) return v.append(h(".card", h("h2", "Coming soon"), h("p", "Lectures for this class are being added.")));
  const ex = EXAMS[sj.id];
  v.append(h(".grid", ls.map((l, i) => {
    const s = S.lectureStats(l);
    return h("button.card.lec", { style: `animation-delay:${i * 45}ms`, onclick: () => (location.hash = `#/l/${l.id}/notes`) },
      symTile(l, 52),
      h("div", { style: "flex:1" }, h("b", l.title), h("small", (l.chapter || "") + ` · ${l.sections.length} topics`)),
      ring(s.pct, l.color));
  })));
  if (ex) {
    const run = (t, shuf) => { v.replaceChildren(); const list = shuf ? shuffle(t.questions.slice()) : t.questions.slice(); runQuiz(v, list, t.title, sj.color, () => { v.replaceChildren(); viewSubject(v, id); }); };
    v.append(h("h2", { style: "margin-top:22px" }, "Practice exams"), h("p", { style: "color:var(--mute);margin:0 0 8px" }, ex.intro || "Real exam-style questions. Take them in order like a test, or shuffled."),
      h(".grid", ex.tests.map((t, i) => h(".card", { style: `animation:rise .4s var(--ease) ${i * 50}ms backwards` },
        h(".row", { style: "flex-wrap:nowrap;margin-bottom:6px" }, h(".symtile", { style: `width:44px;height:44px;background:${sj.color}26;color:${sj.color}` }, ic("exam", 22)), h("div", h("b", t.title), h(".src", { style: "margin:0" }, `${t.questions.length} questions`))),
        t.blurb ? h("p", { style: "margin:4px 0 10px;color:var(--mute);font-size:.9rem" }, t.blurb) : "",
        h(".row", h("button.btn.sm", { style: `--c:${sj.color}`, onclick: () => run(t, false) }, "Start in order"), h("button.btn.alt.sm", { onclick: () => run(t, true) }, "Shuffled"))))));
  }
}

let focus = null; // class chosen on the Cards / Practice / Progress pages
const pool_ = () => open_().filter((l) => !focus || l.subject === focus);
function classChips(redraw) {
  const subs = SUBJECTS.filter((sj) => S.hasAccess(sj.id) && LECS.some((l) => l.subject === sj.id));
  if (subs.length < 2) { focus = subs[0]?.id || null; return ""; }
  return h(".row", { style: "margin:4px 0 8px" }, h("button.chip" + (!focus ? ".on" : ""), { onclick: () => { focus = null; redraw(); } }, "All classes"),
    subs.map((sj) => h("button.chip" + (focus === sj.id ? ".on" : ""), { onclick: () => { focus = sj.id; redraw(); } }, [ic(symOf(sj), 15), sj.name])));
}

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
    h(".hero", { style: "padding-bottom:0" }, h(".row", { style: "flex-wrap:nowrap" }, symTile(l, 48), h("div", { style: "flex:1" }, h("h1", l.title), h("p", l.chapter || "")), ring(s.pct, l.color, 52))),
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
function lightbox(im) {
  const lb = h(".lightbox", { onclick: () => lb.remove() }, h("button.chip.x", { "aria-label": "Close" }, ic("x", 18), "Close"), h("img", { src: im.src, alt: im.alt }));
  document.body.append(lb);
}
// One box: a picture and its own explanation. Changing the picture (1/3, 2/3...) changes the text with it.
function stepper(sec) {
  const steps = sec.steps?.length ? sec.steps : (sec.images?.length ? sec.images.map((im) => ({ img: im, bullets: [] })) : []);
  if (!steps.length) return "";
  let i = 0, dir = 1;
  const wrap = h(".stepper");
  const draw = () => {
    const st = steps[i], im = st.img, n = steps.length;
    const go = (d) => { dir = d; i = (i + d + n) % n; draw(); };
    const fig = im ? h(".fig", { role: "button", tabindex: 0, "aria-label": "Enlarge picture", onclick: () => lightbox(im) },
      h("img", { src: im.src, alt: im.alt || sec.title, loading: "lazy" }), h("span.zoom", ic("zoom", 14), "Enlarge"),
      n > 1 ? [h("button.nv.l", { "aria-label": "Previous", onclick: (e) => { e.stopPropagation(); go(-1); } }, ic("left", 18)), h("button.nv.r", { "aria-label": "Next", onclick: (e) => { e.stopPropagation(); go(1); } }, ic("right", 18))] : "",
      n > 1 ? h("span.cnt", `${i + 1} / ${n}`) : "") : "";
    const txt = h(".steptxt" + (dir < 0 ? ".back" : ""),
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
        stepper(p),
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
      h(".card", { style: "margin-top:10px" }, q.img ? h(".qimg", { role: "button", tabindex: 0, "aria-label": "Enlarge picture", onclick: () => lightbox(q.img) }, h("img", { src: q.img.src, alt: q.img.alt || "Figure for the question", loading: "lazy" })) : "", h(".q", md(q.q)), opts, fb));
  };
  draw();
}

function viewAllCards(v) {
  const draw = () => {
    v.replaceChildren(h(".hero", h("h1", "Flashcards"), h("p", "Mix every lecture, or tap a lecture to focus on it.")));
    const LS = pool_(), body = h("div"), chips = h(".row", { style: "margin:6px 0" });
    const show = (sel) => {
      chips.replaceChildren(h("button.chip" + (!sel ? ".on" : ""), { onclick: () => show(null) }, "All lectures"),
        ...LS.map((l) => h("button.chip" + (sel === l ? ".on" : ""), { onclick: () => show(l) }, [ic(symOf(l), 15), l.title])));
      body.replaceChildren(); cards(body, sel ? sel.cards : shuffle(LS.flatMap((l) => l.cards)), sel ? sel.color : "#2563eb");
    };
    v.append(classChips(draw), chips, body); show(null);
  };
  draw();
}

function viewPractice(v) {
  let sel = null;
  const draw = () => {
    const LS = pool_(), all = LS.flatMap((l) => (l.quiz || []).map((q) => ({ ...q, lec: l.id })));
    v.replaceChildren(h(".hero", h("h1", "Practice exam"), h("p", "Mixed questions, shuffled like the real thing. Pick lectures or take them all.")), classChips(() => { sel = null; draw(); }));
    const pool = sel ? all.filter((q) => sel.has(q.lec)) : all;
    v.append(h(".row", { style: "margin-bottom:10px" }, h("button.chip" + (!sel ? ".on" : ""), { onclick: () => { sel = null; draw(); } }, "All lectures"),
      LS.map((l) => h("button.chip" + (sel?.has(l.id) ? ".on" : ""), { onclick: () => { sel = sel || new Set(); sel.has(l.id) ? sel.delete(l.id) : sel.add(l.id); if (!sel.size) sel = null; draw(); } }, [ic(symOf(l), 15), l.title]))),
      h(".card", h("p", `${pool.length} questions available.`),
        h(".row", [10, 20, 40, pool.length].filter((n, k, a) => n <= pool.length && a.indexOf(n) === k).map((n) =>
          h("button.btn", { style: "--c:#2563eb", onclick: () => { v.replaceChildren(); runQuiz(v, shuffle(pool.slice()).slice(0, n), "Practice exam", "#2563eb", draw); } }, n === pool.length ? `All ${n}` : `${n} questions`)))));
  };
  draw();
}

/* ---------- progress ---------- */
function viewProgress(v) {
  const draw = () => {
    v.replaceChildren();
    const LS = pool_(), st = S.streak(), x = S.xp(open_());
    const total = LS.length ? Math.round(LS.reduce((s, l) => s + S.lectureStats(l).pct, 0) / LS.length) : 0;
    const weak = LS.flatMap((l) => (l.quiz || []).filter((q) => { const p = S.progress().quiz[q.id]; return p && p.attempts && p.correct / p.attempts < 0.6; }).map((q) => ({ l, q })));
    const pr = S.progress();
    const badges = [
      [`3-day streak`, st >= 3, "fire"], ["First topic read", Object.keys(pr.read).length > 0, "notes"],
      ["10 cards known", Object.values(pr.cards).filter((c) => c === "know").length >= 10, "cards"],
      ["10 questions right", Object.values(pr.quiz).filter((c) => c.last).length >= 10, "quiz"],
      ["First game", Object.keys(pr.games).length > 0, "games"], ["Lecture 100%", open_().some((l) => S.lectureStats(l).pct === 100), "star"],
      ["Level 5", x.lvl >= 5, "star"],
    ];
    v.append(h(".hero", h("h1", "My progress")), classChips(draw),
      h(".card.row", ring(total, "#2563eb", 76), h("div", h("b", "Overall completion"), h("p", { style: "margin:0;color:var(--mute)" }, `Level ${x.lvl} · ${x.xp} XP` + (st ? ` · ${st}-day streak` : "")))),
      h("h2", { style: "margin-top:18px" }, "By lecture"),
      h(".grid", LS.map((l) => { const s = S.lectureStats(l); return h(".card", h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("b", [ic(symOf(l), 15), l.title]), ring(s.pct, l.color, 44)),
        h(".src", `Notes ${s.read}/${s.secs} · Cards ${s.known}/${s.cards} · Quiz ${s.right}/${s.qs}`)); })),
      h("h2", { style: "margin-top:18px" }, "Weak topics"),
      weak.length ? weak.map(({ l, q }) => h(".fb", h("b", l.title + ": "), md(q.q.split(String.fromCharCode(10))[0]))) : h("p", "No weak topics yet. Take a quiz and they'll show up here."),
      h("h2", { style: "margin-top:18px" }, "Badges"), h("div", badges.map(([t, on, icn]) => h("span.badge" + (on ? "" : ".lock"), ic(icn, 16), t))));
  };
  draw();
}

/* ---------- admin ---------- */
async function viewAdmin(v) {
  v.append(h(".hero", h("h1", "Admin"), h("p", "Everyone's progress and class codes. You can block or remove anyone.")), h("p", "Loading..."));
  const [{ profiles, progress, error }, codesR, accessRows] = await Promise.all([S.adminList(), S.adminCodes(), S.adminAccess()]);
  v.lastChild.remove();
  if (error) return v.append(h("p.err", error.message));
  const codes = Object.fromEntries((codesR.data || []).map((c) => [c.class_id, c.code]));
  const accessBy = {}; accessRows.forEach((a) => (accessBy[a.user_id] ||= new Set()).add(a.class_id));
  const byId = Object.fromEntries(progress.map((p) => [p.user_id, p]));
  let sj = SUBJECTS[0]?.id;
  const draw = () => {
    v.replaceChildren(h(".hero", h("h1", "Admin"), h("p", "Everyone's progress and class codes. You can block or remove anyone.")));
    const ls = LECS.filter((l) => l.subject === sj);
    const rows = profiles.map((p) => {
      const d = byId[p.id]?.data || { cards: {}, quiz: {}, read: {}, games: {} };
      const stats = ls.map((l) => {
        const secs = (l.sections || []).filter((s) => d.read?.[l.id]?.[s.id]).length;
        const known = l.cards.filter((c) => d.cards?.[c.id] === "know").length;
        const right = (l.quiz || []).filter((q) => d.quiz?.[q.id]?.last).length;
        const games = Math.min((l.games || []).filter((g) => d.games?.[l.id + ":" + g]).length, 3);
        const parts = [[secs, (l.sections || []).length], [known, l.cards.length], [right, (l.quiz || []).length], [games, 3]].filter((x) => x[1]);
        return Math.round((parts.reduce((s, x) => s + x[0] / x[1], 0) / (parts.length || 1)) * 100);
      });
      const avg = stats.length ? Math.round(stats.reduce((a, c) => a + c, 0) / stats.length) : 0;
      const att = Object.values(d.quiz || {}).reduce((s, x) => s + x.attempts, 0), cor = Object.values(d.quiz || {}).reduce((s, x) => s + x.correct, 0);
      return { p, stats, avg, acc: att ? Math.round((cor / att) * 100) : null, last: byId[p.id]?.updated_at, classes: [...(accessBy[p.id] || [])] };
    });
    v.append(h(".card", h("b", `${rows.length} accounts`), h(".src", "Columns show each lecture's completion for the class you pick.")),
      h(".row", { style: "margin:10px 0" }, SUBJECTS.map((x) => h("button.chip" + (sj === x.id ? ".on" : ""), { onclick: () => { sj = x.id; draw(); } }, [ic(symOf(x), 15), x.name]))),
      h(".tw", h("table", h("thead", h("tr", ["Student", "Classes", "Overall", ...ls.map((l) => ic(symOf(l), 16)), "Quiz acc.", "Last active", ""].map((x) => h("th", x)))),
        h("tbody", rows.map((r) => h("tr",
          h("td", h("b", r.p.display_name || ""), h(".src", r.p.email), r.p.is_admin ? h("span.pill", { style: "background:#2563eb" }, "admin") : "", r.p.blocked ? h("span.pill", { style: "background:#dc2626" }, "blocked") : ""),
          h("td", r.p.is_admin ? "all" : r.classes.map((c) => SUBJECTS.find((x) => x.id === c)?.name || c).join(", ") || "none yet"),
          h("td", r.avg + "%"), ...r.stats.map((x) => h("td", x + "%")),
          h("td", r.acc === null ? "-" : r.acc + "%"), h("td", r.last ? new Date(r.last).toLocaleDateString() : "-"),
          h("td", r.p.is_admin ? "" : h(".row", { style: "flex-wrap:nowrap" },
            h("button.btn.alt.sm", { onclick: async () => { await S.adminBlock(r.p.id, !r.p.blocked); route(); } }, r.p.blocked ? "Unblock" : "Block"),
            h("button.btn.warn.sm", { onclick: async () => { if (confirm("Permanently remove " + r.p.email + "?")) { const x = await S.adminDelete(r.p.id); if (x.error) toast(x.error.message); route(); } } }, "Kick")))))))),
      h(".card", { style: "margin-top:14px" }, h("h3", "Class access codes"),
        SUBJECTS.map((x) => { const inp = h("input", { value: codes[x.id] || "", placeholder: "Set a code", "aria-label": x.name + " code" });
          return h("div", { style: "margin:8px 0" }, h("label", { style: "margin:0 0 4px" }, [ic(symOf(x), 15), x.name]), h(".row", { style: "flex-wrap:nowrap" }, inp,
            h("button.btn.sm", { onclick: async () => { if (!inp.value.trim()) return; const r = await S.adminSetCode(x.id, inp.value.trim()); toast(r.error ? r.error.message : x.name + " code saved"); } }, "Save"))); })));
  };
  draw();
}

boot().catch((e) => { app.replaceChildren(h("p.boot", "Something went wrong: " + e.message)); console.error(e); });
