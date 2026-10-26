// In-app notifications: short, personal nudges shown on Home. They can be switched off in Profile.
// (True push messages to a phone that is not running the app need a small server job; this site has none, so these appear when the app is open.)
import * as S from "./store.js";
import { h, ic, firstName } from "./ui.js";

export const notifOn = () => S.prefs().notif?.app !== false;
export const setNotifOn = (on) => S.setPrefs({ notif: { ...(S.prefs().notif || {}), app: !!on } });

const DAY = 864e5;
export const daysUntil = (iso, now = new Date()) => Math.round((new Date(iso + "T00:00:00") - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
function phrase(d) { return d <= 0 ? "today" : d === 1 ? "tomorrow" : d <= 3 ? `in ${d} days` : d <= 7 ? "in 1 week" : "in 2 weeks"; }
// 14, 7, 3, 1 and 0 days before: each is its own message, shown once
const bucket = (d) => (d <= 0 ? 0 : d <= 1 ? 1 : d <= 3 ? 3 : d <= 7 ? 7 : d <= 14 ? 14 : null);

// ctx: { name, exams: [{ cid, cname, exam_name, exam_date, sprintLec }], streak, studiedToday, hour, dueByClass: [{ cid, n }], lastGame, sharedToday }
export function computeNotes(ctx, now = new Date()) {
  const who = firstName(ctx.name) || "there", out = [], day = S.localDay(now);
  for (const e of ctx.exams || []) {
    const d = daysUntil(e.exam_date, now), b = d >= 0 ? bucket(d) : null; if (b === null) continue;
    const what = (e.exam_name || "exam").toLowerCase();
    out.push({ id: `exam:${e.cid}:${e.exam_date}:${b}`, kind: "exam",
      title: d === 0 ? `Hello ${who}, your ${what} is ${phrase(d)}.` : `Hello ${who}, your ${what} is coming up ${phrase(d)}.`,
      body: d === 0 ? `You have put in the work. Warm up with a quick sprint! (${e.cname})` : `Do a sprint practice test! (${e.cname})`,
      cta: e.sprintLec ? { label: "Start a sprint", to: `#/play/${e.sprintLec}/speed` } : { label: "Open the class", to: `#/s/${e.cid}` } });
  }
  if (ctx.streak >= 2 && !ctx.studiedToday && (ctx.hour ?? now.getHours()) >= 17)
    out.push({ id: `streak:${day}`, kind: "streak", title: `${who}, your ${ctx.streak}-day streak is waiting.`, body: "A few minutes of review keeps it alive.", cta: { label: "Review cards", to: "#/cards" } });
  const due = (ctx.dueByClass || []).slice().sort((a, b) => b.n - a.n)[0];
  if (due && due.n >= 5) out.push({ id: `due:${day}`, kind: "due", title: `${who}, ${due.n} flashcards are ready to review.`, body: "Cards come back when your memory needs them most.", cta: { label: "Review now", to: `#/s/${due.cid}` } });
  if (ctx.lastGame && ctx.lastGame.day === day && !ctx.sharedToday)
    out.push({ id: `challenge:${day}`, kind: "challenge", title: "Challenge a friend on this game!", body: `${ctx.lastGame.score != null ? `You scored ${ctx.lastGame.score}/${ctx.lastGame.total}. ` : ""}See if they can beat you.`, cta: { label: "Challenge", act: "challenge" } });
  return out;
}

const seen = () => S.prefs().noteSeen || {};
export function dismissNote(id) {
  const m = { ...seen(), [id]: Date.now() };
  for (const [k, t] of Object.entries(m)) if (Date.now() - t > 90 * DAY) delete m[k]; // old ones are forgotten
  S.setPrefs({ noteSeen: m });
}
export const visibleNotes = (notes) => (notifOn() ? notes.filter((n) => !seen()[n.id]).slice(0, 2) : []);

// onGo(note) runs the action; the card removes itself when dismissed
export function notesCards(notes, { onGo }) {
  return visibleNotes(notes).map((n) => {
    const el = h(".card.note", { role: "status", style: "margin-bottom:12px" },
      h(".grow", h("b", n.title), h("p", n.body), n.cta ? h("button.btn.sm", { onclick: () => { onGo(n); } }, n.cta.label) : ""),
      h("button.x", { "aria-label": "Dismiss this message", onclick: () => { dismissNote(n.id); el.remove(); } }, ic("x", 18)));
    return el;
  });
}
