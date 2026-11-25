// The feedback survey: a link (#/feedback, or #/feedback/<course>) that staff send to students, the short survey the link opens,
// and the summary staff see. Answers go into the same feedback list as the profile review (a star rating and one message),
// so nothing new is needed in the database.
import * as S from "./store.js";
import { h, ic, toast } from "./ui.js";
import { starPicker } from "./profile.js";

const HELPS = ["Notes and pictures", "Flashcards", "Quizzes", "Games", "Practice tests", "Glossary"];
const EASE = ["Very easy", "Okay", "Hard"];
const TELL = ["Yes", "Maybe", "No"];
const HEAD = "Survey";
const LINES = { helps: "Helps most", ease: "Easy to use", tell: "Tell a classmate", fix: "Fix or add", like: "Like most" };

// one-choice or many-choice buttons
function choices(options, { many = false, label }) {
  const picked = new Set();
  const row = h(".row", { role: many ? "group" : "radiogroup", "aria-label": label, style: "gap:6px;flex-wrap:wrap" });
  const paint = () => [...row.children].forEach((b) => { const on = picked.has(b.dataset.v); b.classList.toggle("on", on); b.setAttribute(many ? "aria-pressed" : "aria-checked", String(on)); });
  for (const o of options) row.append(h("button.chip", { type: "button", role: many ? null : "radio", "data-v": o, onclick: () => { if (many) picked.has(o) ? picked.delete(o) : picked.add(o); else { picked.clear(); picked.add(o); } paint(); } }, o));
  paint();
  return { el: row, get value() { return options.filter((o) => picked.has(o)); } };
}

// the course this survey is about: the one in the link if the student is in it, otherwise the class open on Home, otherwise their only class
function courseFor(fromLink, classes, current) {
  if (fromLink && classes.some((c) => c.id === fromLink)) return fromLink;
  return current || (classes.length === 1 ? classes[0].id : null);
}

export function buildMessage({ helps = [], ease = "", tell = "", like = "", fix = "" }) {
  const lines = [HEAD];
  if (helps.length) lines.push(`${LINES.helps}: ${helps.join(", ")}`);
  if (ease) lines.push(`${LINES.ease}: ${ease}`);
  if (tell) lines.push(`${LINES.tell}: ${tell}`);
  const head = lines.join("\n"), room = 1000 - head.length;
  const parts = [like.trim() && `${LINES.like}: ${like.trim()}`, fix.trim() && `${LINES.fix}: ${fix.trim()}`].filter(Boolean).join("\n");
  return parts ? head + "\n" + parts.slice(0, Math.max(0, room - 1)) : head;
}

export function parseMessage(m) {
  const lines = String(m || "").split("\n");
  if (lines[0] !== HEAD) return null;
  const out = {};
  for (const ln of lines.slice(1)) for (const [k, label] of Object.entries(LINES)) if (ln.startsWith(label + ": ")) out[k] = ln.slice(label.length + 2);
  if (out.helps) out.helps = out.helps.split(", ");
  return out;
}

/* ---------- what the student sees ---------- */
export function viewSurvey(v, { courseId, classes = [], current = null, subjects = [] } = {}) {
  const course = courseFor(courseId, classes, current), name = subjects.find((s) => s.id === course)?.name;
  const stars = starPicker(), helps = choices(HELPS, { many: true, label: "What helps you most" }), ease = choices(EASE, { label: "How easy is Ace It to use" }), tell = choices(TELL, { label: "Would you tell a classmate about Ace It" });
  const like = h("textarea", { rows: 2, maxlength: 400, placeholder: "Optional", "aria-label": "What do you like most" });
  const fix = h("textarea", { rows: 3, maxlength: 500, placeholder: "Optional: something confusing, a mistake, or a topic you want more help with", "aria-label": "What should we fix or add" });
  const err = h(".src", { role: "alert", style: "color:var(--coral);margin:6px 0 0" });
  const q = (n, text, ...body) => h("div", { style: "margin-top:16px" }, h("b", `${n}. ${text}`), ...body);
  const send = h("button.btn", { style: "margin-top:16px", onclick: async () => {
    err.textContent = "";
    if (!stars.value) { err.textContent = "Pick a star rating for question 1."; return; }
    send.disabled = true;
    const msg = buildMessage({ helps: helps.value, ease: ease.value[0], tell: tell.value[0], like: like.value, fix: fix.value });
    const r = S.DEMO ? { error: null } : await S.sendFeedback(course, stars.value, msg);
    if (r.error) { err.textContent = /too many/i.test(r.error.message) ? "You have sent a lot of feedback today. Please try again tomorrow." : "Could not send. Check your connection and try again."; send.disabled = false; return; }
    S.bump("reviews"); S.setPrefs({ reviewed: true, surveyAt: new Date().toISOString().slice(0, 10) });
    v.replaceChildren(h(".card", { style: "text-align:center" }, h("h2", "Thank you!"), h("p", "Your answers were sent. They help make Ace It better for your class."),
      h("button.btn", { onclick: () => (location.hash = "#/") }, "Back to Home")));
  } }, "Send my answers");
  v.replaceChildren(h(".card",
    h("h2", { style: "margin-top:0" }, "Tell us how Ace It is going"), h("p", { style: "margin:4px 0 0" }, (name ? `For ${name}. ` : "") + "It takes about one minute. Your instructor and the Ace It team see your answers with your class, not your name in public."),
    q(1, "How would you rate Ace It overall?", stars.el),
    q(2, "What helps you most? Pick any.", helps.el),
    q(3, "How easy is it to use?", ease.el),
    q(4, "Would you tell a classmate about it?", tell.el),
    q(5, "What do you like most?", like),
    q(6, "What should we fix or add?", fix),
    err, send));
}

/* ---------- what staff see ---------- */
export const surveyUrl = (courseId) => `${location.origin}${location.pathname}#/feedback${courseId ? "/" + encodeURIComponent(courseId) : ""}`;

// a box with the link to send to students, a Copy button and (on phones) Share
export function shareSurveyBox(courseId, courseName) {
  const url = surveyUrl(courseId), text = `Please tell us how Ace It is going${courseName ? " in " + courseName : ""}. It takes about one minute: ${url}`;
  const field = h("input", { value: url, readonly: true, "aria-label": "Feedback survey link", onfocus: (e) => e.target.select(), style: "flex:1;min-width:0" });
  const copy = async (t, done) => { try { await navigator.clipboard.writeText(t); toast(done); } catch { field.focus(); field.select(); toast("Select the link and copy it"); } };
  return h("div", { style: "margin:4px 0 10px" },
    h(".src", { style: "margin:0 0 6px" }, "Send this link to your students (email, your class page or a group chat). It opens a one-minute survey after they sign in."),
    h(".row", { style: "flex-wrap:nowrap;gap:6px" }, field, h("button.btn.sm", { onclick: () => copy(url, "Link copied") }, ic("copy", 14), "Copy")),
    h(".row", { style: "gap:6px;margin-top:6px" },
      h("button.chip", { onclick: () => copy(text, "Message copied") }, "Copy a ready-to-send message"),
      navigator.share ? h("button.chip", { onclick: () => navigator.share({ title: "Ace It feedback", text, url }).catch(() => {}) }, "Share") : ""));
}

// the average, the survey answers counted up, and every message (the newest 6 first, the rest behind "Show all")
export function feedbackSummary(list, { showClass = false } = {}) {
  if (!list.length) return h(".src", "No feedback yet. Send students the survey link above.");
  const avg = (list.reduce((t, f) => t + (f.rating || 0), 0) / list.length).toFixed(1);
  const surveys = list.map((f) => parseMessage(f.message)).filter(Boolean);
  const count = (key, opts) => { const n = Object.fromEntries(opts.map((o) => [o, 0])); for (const s of surveys) for (const v of [].concat(s[key] || [])) if (v in n) n[v]++; return opts.filter((o) => n[o]).map((o) => `${o} ${n[o]}`).join(" · "); };
  const tallies = surveys.length ? h(".fb", { style: "margin:6px 0" }, h("b", `${surveys.length} survey${surveys.length === 1 ? "" : "s"}`),
    ...[["Helps most", count("helps", HELPS)], ["Easy to use", count("ease", EASE)], ["Tell a classmate", count("tell", TELL)]].filter(([, t]) => t).map(([k, t]) => h("div", h("span", k + ": "), t))) : "";
  const row = (f) => h(".fb", { style: "margin-top:6px;white-space:pre-line" }, h("b", "★".repeat(f.rating || 0) + " "), (f.message || "(no message)").replace(/^Survey\n/, ""), h(".src", `${new Date(f.at).toLocaleDateString()}${showClass && f.class_id ? ", " + f.class_id : ""}`));
  const rest = h("div", { hidden: true }, ...list.slice(6).map(row));
  const more = list.length > 6 ? h("button.chip", { style: "margin-top:8px", onclick: () => { rest.hidden = !rest.hidden; more.textContent = rest.hidden ? `Show all ${list.length}` : "Show fewer"; } }, `Show all ${list.length}`) : "";
  return h("div", h("p", { style: "margin:0 0 6px" }, `Average rating ${avg} from ${list.length} message${list.length === 1 ? "" : "s"}.`), tallies, ...list.slice(0, 6).map(row), rest, more);
}
