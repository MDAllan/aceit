// The feedback survey: a link (#/feedback, or #/feedback/<course>) that staff send to students, the short survey the link opens,
// and the summary staff see. Answers go into the same feedback list as the profile review (a star rating and one message),
// so nothing new is needed in the database.
// The survey is: stars, a written review, one 1-10 bar ("how much has Ace It helped you study?") and permission to quote.
// The stars and the bar turn straight into lines for the website: "4.8 stars from 52 students", "92% say it helped them study".
import * as S from "./store.js";
import { h, ic, toast } from "./ui.js";
import { starPicker } from "./profile.js";

const HEAD = "Survey";
export const HELP_Q = "How much has Ace It helped you study for this class?";
// every line a survey message can hold (older surveys used the other lines; they still read back)
const LINES = { score: "Helped score", quote: "OK to quote", review: "Review", helped: "Helped me", tell: "Recommend", improve: "Improve", helps: "Helps most", ease: "Easy to use", like: "Like most", fix: "Fix or add" };

// the course this survey is about: the one in the link if the student is in it, otherwise the class open on Home, otherwise their only class
function courseFor(fromLink, classes, current) {
  if (fromLink && classes.some((c) => c.id === fromLink)) return fromLink;
  return current || (classes.length === 1 ? classes[0].id : null);
}

export function buildMessage({ score = 0, review = "", quote = false }) {
  const head = [HEAD, score ? `${LINES.score}: ${score}` : "", `${LINES.quote}: ${quote ? "Yes" : "No"}`].filter(Boolean).join("\n");
  const text = review.trim().replace(/\s*\n\s*/g, " ");
  return text ? head + "\n" + `${LINES.review}: ${text}`.slice(0, 1000 - head.length - 1) : head;
}

export function parseMessage(m) {
  const lines = String(m || "").split("\n");
  if (lines[0] !== HEAD) return null;
  const out = {};
  for (const ln of lines.slice(1)) for (const [k, label] of Object.entries(LINES)) if (ln.startsWith(label + ": ")) out[k] = ln.slice(label.length + 2);
  if (out.score) out.score = Number(out.score) || 0;
  return out;
}

// a bar of 10 boxes: tap one and the bar fills up to it (arrow keys work too)
function helpBar() {
  let value = 0;
  const label = h(".src", { "aria-live": "polite", style: "margin:4px 0 0" });
  const bar = h("div", { role: "radiogroup", "aria-label": HELP_Q, style: "display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:8px" });
  const paint = () => {
    [...bar.children].forEach((b, i) => { const on = i < value; b.style.background = on ? "var(--c, var(--brand))" : "transparent"; b.style.color = on ? "#fff" : "inherit"; b.setAttribute("aria-checked", String(i + 1 === value)); b.tabIndex = (value ? i + 1 === value : i === 0) ? 0 : -1; });
    label.textContent = value ? `${value} out of 10` : "Tap the bar: 1 is not at all, 10 is a lot";
  };
  const set = (n) => { value = Math.max(1, Math.min(10, n)); paint(); bar.children[value - 1].focus(); };
  for (let n = 1; n <= 10; n++) bar.append(h("button", { type: "button", role: "radio", "aria-label": `${n} out of 10`, style: "height:40px;border:2px solid var(--c, var(--brand));border-radius:8px;font:inherit;font-weight:700;cursor:pointer;padding:0",
    onclick: () => { value = n; paint(); }, onkeydown: (e) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") { set((value || 0) + 1); e.preventDefault(); } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { set((value || 2) - 1); e.preventDefault(); } } }, String(n)));
  paint();
  return { el: h("div", bar, h(".row", { style: "justify-content:space-between;margin-top:2px" }, h(".src", { style: "margin:0" }, "Not at all"), h(".src", { style: "margin:0" }, "A lot")), label), get value() { return value; } };
}

/* ---------- what the student sees ---------- */
export function viewSurvey(v, { courseId, classes = [], current = null, subjects = [] } = {}) {
  const course = courseFor(courseId, classes, current), name = subjects.find((s) => s.id === course)?.name;
  const stars = starPicker(), bar = helpBar();
  const review = h("textarea", { rows: 4, maxlength: 600, placeholder: "For example: what got easier, or how it helped you before a test", "aria-label": "Your review" });
  const quote = h("input", { type: "checkbox", id: "svq" });
  const err = h(".src", { role: "alert", style: "color:var(--coral);margin:6px 0 0" });
  const q = (n, text, ...body) => h("div", { style: "margin-top:16px" }, h("b", `${n}. ${text}`), ...body);
  const send = h("button.btn", { style: "margin-top:16px", onclick: async () => {
    err.textContent = "";
    if (!stars.value) { err.textContent = "Pick a star rating for question 1."; return; }
    if (!bar.value) { err.textContent = "Tap the bar for question 2."; return; }
    send.disabled = true;
    const msg = buildMessage({ score: bar.value, review: review.value, quote: quote.checked });
    const r = S.DEMO ? { error: null } : await S.sendFeedback(course, stars.value, msg);
    if (r.error) { err.textContent = /too many/i.test(r.error.message) ? "You have sent a lot of feedback today. Please try again tomorrow." : "Could not send. Check your connection and try again."; send.disabled = false; return; }
    S.bump("reviews"); S.setPrefs({ reviewed: true, surveyAt: new Date().toISOString().slice(0, 10) });
    v.replaceChildren(h(".card", { style: "text-align:center" }, h("h2", "Thank you!"), h("p", "Your review was sent. It helps make Ace It better for your class."),
      h("button.btn", { onclick: () => (location.hash = "#/") }, "Back to Home")));
  } }, "Send my review");
  v.replaceChildren(h(".card",
    h("h2", { style: "margin-top:0" }, "Review Ace It"), h("p", { style: "margin:4px 0 0" }, (name ? `For ${name}. ` : "") + "It takes less than a minute. Your instructor and the Ace It team read your answers."),
    q(1, "How many stars would you give Ace It?", stars.el),
    q(2, HELP_Q, bar.el),
    q(3, "Write a short review (optional)", review),
    h("label", { for: "svq", style: "display:flex;gap:8px;align-items:flex-start;margin-top:16px;font-weight:normal" }, quote,
      h("span", "OK to show my stars, my review and my first name on the Ace It website. We never show your last name or email, and you can ask us to remove it any time.")),
    err, send));
}

/* ---------- what staff see ---------- */
export const surveyUrl = (courseId) => `${location.origin}${location.pathname}#/feedback${courseId ? "/" + encodeURIComponent(courseId) : ""}`;

// a box with the link to send to students, a Copy button and (on phones) Share
export function shareSurveyBox(courseId, courseName) {
  const url = surveyUrl(courseId), text = `Please review Ace It${courseName ? " for " + courseName : ""}. It takes less than a minute: ${url}`;
  const field = h("input", { value: url, readonly: true, "aria-label": "Review survey link", onfocus: (e) => e.target.select(), style: "flex:1;min-width:0" });
  return h("div", { style: "margin:4px 0 10px" },
    h(".src", { style: "margin:0 0 6px" }, "Send this link to your students (email, your class page or a group chat). It opens a short review after they sign in: stars, one question and an optional comment."),
    h(".row", { style: "flex-wrap:nowrap;gap:6px" }, field, h("button.btn.sm", { onclick: () => copyText(url, "Link copied", field) }, ic("copy", 14), "Copy")),
    h(".row", { style: "gap:6px;margin-top:6px" },
      h("button.chip", { onclick: () => copyText(text, "Message copied", field) }, "Copy a ready-to-send message"),
      navigator.share ? h("button.chip", { onclick: () => navigator.share({ title: "Review Ace It", text, url }).catch(() => {}) }, "Share") : ""));
}
async function copyText(t, done, field) { try { await navigator.clipboard.writeText(t); toast(done); } catch { field?.focus(); field?.select(); toast("Select it and copy it"); } }

// the numbers for the website, worked out from every survey and review
export function websiteStats(list) {
  const rated = list.filter((f) => f.rating), scores = list.map((f) => parseMessage(f.message)?.score).filter((n) => n > 0);
  return {
    reviews: rated.length,
    stars: rated.length ? rated.reduce((t, f) => t + f.rating, 0) / rated.length : 0,
    answered: scores.length,
    helpAvg: scores.length ? scores.reduce((t, n) => t + n, 0) / scores.length : 0,
    helpedPct: scores.length ? Math.round((100 * scores.filter((n) => n >= 7).length) / scores.length) : 0, // 7 to 10 on the bar counts as "helped"
  };
}

const meter = (pct) => h("div", { style: "height:10px;border-radius:6px;background:var(--line);overflow:hidden;margin:4px 0 8px" }, h("div", { style: `height:100%;width:${pct}%;background:var(--c, var(--brand))` }));

// the website numbers as bars, ready-to-copy lines, the reviews students said may be quoted, and every message
export function feedbackSummary(list, { showClass = false } = {}) {
  if (!list.length) return h(".src", "No reviews yet. Send students the link above.");
  const st = websiteStats(list), out = h("div");
  out.append(h("b", `${st.stars.toFixed(1)} out of 5 stars`), h(".src", { style: "margin:0" }, `from ${st.reviews} review${st.reviews === 1 ? "" : "s"}`), meter((st.stars / 5) * 100));
  if (st.answered) out.append(h("b", `${st.helpedPct}% say Ace It helped them study`), h(".src", { style: "margin:0" }, `7 to 10 on the bar · average ${st.helpAvg.toFixed(1)} out of 10 · ${st.answered} answer${st.answered === 1 ? "" : "s"}`), meter(st.helpedPct));
  const lines = [`${st.stars.toFixed(1)} ★ from ${st.reviews} student review${st.reviews === 1 ? "" : "s"}`, st.answered ? `${st.helpedPct}% of students say Ace It helped them study` : ""].filter(Boolean).join("\n");
  out.append(h("button.chip", { onclick: () => copyText(lines, "Copied the website lines") }, ic("copy", 14), "Copy the numbers for the website"));

  const quotable = list.filter((f) => { const p = parseMessage(f.message); return p?.quote === "Yes" && p.review; });
  if (quotable.length) out.append(h("h4", { style: "margin:14px 0 2px" }, `Reviews OK to show on the website (${quotable.length})`),
    ...quotable.slice(0, 20).map((f) => h(".fb", { style: "margin-top:6px" }, h("b", "★".repeat(f.rating || 0) + " "), `"${parseMessage(f.message).review}"`)));

  const row = (f) => { const p = parseMessage(f.message);
    const body = p ? [p.score ? `Helped: ${p.score}/10` : "", p.review || p.helped || "", p.quote === "Yes" ? "(OK to quote)" : ""].filter(Boolean).join(" · ") || "(no comment)" : f.message || "(no message)";
    return h(".fb", { style: "margin-top:6px;white-space:pre-line" }, h("b", "★".repeat(f.rating || 0) + " "), body, h(".src", `${new Date(f.at).toLocaleDateString()}${showClass && f.class_id ? ", " + f.class_id : ""}`)); };
  const rest = h("div", { hidden: true }, ...list.slice(6).map(row));
  const more = list.length > 6 ? h("button.chip", { style: "margin-top:8px", onclick: () => { rest.hidden = !rest.hidden; more.textContent = rest.hidden ? `Show all ${list.length}` : "Show fewer"; } }, `Show all ${list.length}`) : "";
  out.append(h("h4", { style: "margin:14px 0 2px" }, "All reviews"), ...list.slice(0, 6).map(row), rest, more);
  return out;
}
