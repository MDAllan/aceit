// The profile screen, the profile picture / avatar, the review stars and the "how is it going?" popup.
import * as S from "./store.js";
import { h, ic, toast, openModal, firstName } from "./ui.js";
import { mfaCard } from "./mfa.js";
import { notifOn, setNotifOn } from "./notify.js";

export const AV_SYMS = ["globe", "telescope", "rocket", "gem", "volcano", "atom", "orbit", "bolt", "wave", "clock", "trophy", "brain"];
export const AV_COLS = ["#324586", "#323C64", "#3F7FB8", "#2F8F84", "#6F66D6", "#B5566C"];
export const avatarStyle = () => `background:${S.prefs().avatarColor || AV_COLS[0]};color:#F5F6F7`;
// the picture the person uploaded, otherwise the symbol they picked, otherwise the first letter of their name
export function avatarNode(size = 18) {
  const pf = S.prefs();
  if (pf.photo) return h("img.avph", { src: pf.photo, alt: "" });
  return pf.avatarSym ? ic(pf.avatarSym, size) : h("span", (S.myName().slice(0, 1) || "?").toUpperCase());
}

/* ---------- profile photo: any picture from the phone's gallery or the computer, shrunk to a small square ---------- */
async function squarePhoto(file, px = 160) {
  if (!file.type.startsWith("image/") || /svg/i.test(file.type)) throw new Error("Choose a photo (JPG, PNG or WebP).");
  if (file.size > 12 * 1024 * 1024) throw new Error("That picture is too large. Choose one under 12 MB.");
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { throw new Error("This device cannot open that picture. Try a JPG or PNG."); }
  const c = document.createElement("canvas"); c.width = c.height = px;
  const g = c.getContext("2d"), side = Math.min(bmp.width, bmp.height);
  g.fillStyle = "#fff"; g.fillRect(0, 0, px, px);
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, px, px);
  bmp.close?.();
  return c.toDataURL("image/jpeg", 0.82);
}

/* ---------- stars: yellow, big, cartoon style ---------- */
const STAR = "M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z";
function starSvg() {
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path"); p.setAttribute("d", STAR); p.setAttribute("class", "body");
  const e = document.createElementNS(NS, "ellipse"); e.setAttribute("cx", "9.2"); e.setAttribute("cy", "8.4"); e.setAttribute("rx", "1.5"); e.setAttribute("ry", "2.2"); e.setAttribute("transform", "rotate(-35 9.2 8.4)"); e.setAttribute("class", "shine");
  s.append(p, e); return s;
}
const WORDS = ["", "Oh no. Tell us what went wrong.", "Not great. How can we do better?", "It's okay. What would make it better?", "Good! Glad it helps.", "Awesome! You made our day."];
export function starPicker(onChange) {
  let value = 0; const hint = h(".starhint", { "aria-live": "polite" });
  const row = h(".stars", { role: "radiogroup", "aria-label": "Your rating out of 5 stars" });
  const paint = () => { [...row.children].forEach((b, i) => { const on = i < value; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(i + 1 === value)); b.tabIndex = (value ? i + 1 === value : i === 0) ? 0 : -1; }); hint.textContent = WORDS[value] || "Tap a star"; };
  for (let n = 1; n <= 5; n++) row.append(h("button.star", { type: "button", role: "radio", "aria-label": `${n} star${n === 1 ? "" : "s"}`, onclick: () => { value = n; paint(); onChange?.(n); },
    onkeydown: (e) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") { value = Math.min(5, (value || 0) + 1); paint(); row.children[value - 1].focus(); onChange?.(value); e.preventDefault(); } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { value = Math.max(1, (value || 2) - 1); paint(); row.children[value - 1].focus(); onChange?.(value); e.preventDefault(); } } }, starSvg()));
  paint();
  return { el: h("div", row, hint), get value() { return value; }, reset() { value = 0; paint(); } };
}
// sends the rating and message; counts as "reviewed the app" for the badges
async function sendReview(classId, rating, message) {
  if (!rating) { toast("Pick a star rating first"); return false; }
  const r = S.DEMO ? { error: null } : await S.sendFeedback(classId || null, rating, message);
  if (r.error) { toast("Could not send: " + r.error.message); return false; }
  S.bump("reviews"); S.setPrefs({ reviewed: true });
  return true;
}
export function reviewForm(classId, { onSent } = {}) {
  const stars = starPicker(), msg = h("textarea", { rows: 3, maxlength: 1000, placeholder: "Tell us more (optional)", "aria-label": "Feedback message" });
  const send = h("button.btn", { onclick: async () => { send.disabled = true; if (await sendReview(classId, stars.value, msg.value)) { toast("Thank you!"); msg.value = ""; stars.reset(); onSent?.(); } send.disabled = false; } }, "Send");
  return h("div", stars.el, msg, h(".row.end", { style: "margin-top:8px;justify-content:flex-end" }, send));
}
// one day after the first visit, a friendly popup asks how it is going (at most 3 times, a week apart, never after a review)
export function maybeAskReview(classId) {
  if (S.DEMO || !S.session) return;
  const pf = S.prefs(), today = S.localDay();
  if (!pf.firstSeen) { S.setPrefs({ firstSeen: today }); return; }
  const ask = pf.reviewAsk || { n: 0, at: "" };
  const days = (a, b) => Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 864e5);
  if (pf.reviewed || ask.n >= 3 || days(today, pf.firstSeen) < 1 || (ask.at && days(today, ask.at) < 7)) return;
  S.setPrefs({ reviewAsk: { n: ask.n + 1, at: today } });
  const name = firstName(S.myName());
  const stars = starPicker(() => { send.disabled = false; });
  const msg = h("textarea", { rows: 3, maxlength: 1000, placeholder: "Anything you'd like to tell us? (optional)", "aria-label": "Feedback message" });
  const send = h("button.btn", { disabled: true }, "Send");
  const later = h("button.btn.alt", "Maybe later"), never = h("button.btn.alt.sm", { style: "margin-top:8px" }, "Don't ask again");
  const m = openModal(h("div", h("h2", name ? `Hi ${name}, how is Ace It going?` : "How is Ace It going?"),
    h("p", { style: "margin:0;color:var(--mute)" }, "You have been studying with us for a day. Tap a star to tell us how it is going. It takes ten seconds."), stars.el, msg,
    h(".row", { style: "justify-content:flex-end;margin-top:10px" }, later, send), h(".row", { style: "justify-content:center" }, never)), { label: "Review the app" });
  later.onclick = () => m.close();
  never.onclick = () => { S.setPrefs({ reviewAsk: { n: 99, at: today } }); m.close(); };
  send.onclick = async () => { send.disabled = true; if (await sendReview(classId, stars.value, msg.value)) { m.close(); toast("Thank you!"); } else send.disabled = false; };
}

/* ---------- the screen ---------- */
// a row with an on/off switch (the whole row is the button)
export function switchRow(title, desc, on, onChange, first) {
  const b = h("button.swrow" + (first ? ".first" : ""), { type: "button", role: "switch", "aria-checked": String(!!on), onclick: () => onChange(!on) },
    h("span.t", h("b", title), desc ? h("small", desc) : ""), h("span.sw", { "aria-hidden": "true" }));
  return b;
}

// X: { route, setTheme, a11y, setA11y, badges (function giving the Badges section), adminCard (function, for admins), classId }
export function viewProfile(v, X) {
  const draw = () => {
    v.replaceChildren();
    const pf = S.prefs(), email = S.session?.user?.email || "", xp = S.xp(X.lectures());
    const nameIn = h("input", { value: S.myName(), maxlength: 40, "aria-label": "Display name" });
    const nm = h("p.err", { role: "alert", style: "margin:4px 0 0;min-height:0" });
    const pw = h("input", { type: "password", placeholder: "New password (8+ characters)", autocomplete: "new-password", "aria-label": "New password" });
    const pwMsg = h("p.err", { role: "alert", style: "margin:4px 0 0;min-height:0" });
    const cur = document.documentElement.dataset.theme || "auto", A = X.a11y();
    const file = h("input", { type: "file", accept: "image/*", id: "photo-file", "aria-label": "Choose a profile photo" });
    file.onchange = async () => { const f = file.files?.[0]; if (!f) return; try { S.setPrefs({ photo: await squarePhoto(f) }); toast("Photo saved"); } catch (e) { toast(e.message); } draw(); };
    const avatarBox = h("details.panel", { style: "margin-top:10px" }, h("summary", "Or pick an avatar"),
      h(".src", { style: "margin:6px 0" }, "A symbol and a colour. Used when you have no photo."),
      h(".pgrid", AV_SYMS.map((sy) => h("button" + (!pf.photo && pf.avatarSym === sy ? ".on" : ""), { "aria-label": sy, onclick: () => { S.setPrefs({ avatarSym: sy, photo: null }); draw(); } }, ic(sy, 22)))),
      h(".swatches", AV_COLS.map((cl) => h("button" + ((pf.avatarColor || AV_COLS[0]) === cl ? ".on" : ""), { style: `background:${cl}`, "aria-label": "Colour " + cl, onclick: () => { S.setPrefs({ avatarColor: cl }); draw(); } }))));
    v.append(h(".hero", h("h1", "Your profile")),
      h(".card", h(".profhead", h("div.avatar.big", { style: avatarStyle() }, avatarNode(34)), h("div", { style: "min-width:0" }, h("b", { style: "font-size:1.1rem" }, S.myName()), h(".src", { style: "margin:2px 0;overflow-wrap:anywhere" }, email), S.profile?.is_admin ? h("span.pill.navy", "Admin") : h("span.pill", `Level ${xp.lvl}`))),
        h(".photorow", { style: "margin-top:12px" }, file, h("label.btn.sm", { for: "photo-file", role: "button", style: "margin:0", tabindex: "0", onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } } }, ic("image", 16), pf.photo ? "Change photo" : "Upload a photo"),
          pf.photo ? h("button.btn.alt.sm", { onclick: () => { S.setPrefs({ photo: null }); draw(); } }, "Remove photo") : ""), avatarBox),
      h(".card", { style: "margin-top:12px" }, h("h3", "Display name"), h(".row", { style: "flex-wrap:nowrap" }, nameIn, h("button.btn.sm", { onclick: async () => { const n = nameIn.value.trim(); if (!n) { nm.textContent = "Enter a name."; return; } await S.setName(n); toast("Name saved"); draw(); } }, "Save")), nm),
      X.badges ? X.badges() : "",
      h(".card#accessibility", { style: "margin-top:12px" }, h("h3", "Accessibility"), h(".src", { style: "margin:0 0 4px" }, "Saved on this device."),
        h("label", { style: "margin:8px 0 4px" }, "Appearance"),
        h(".seg", [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([k, t]) => h("button.btn.sm" + (cur === k ? "" : ".alt"), { "aria-pressed": String(cur === k), onclick: () => { X.setTheme(k); draw(); } }, t))),
        switchRow("Color-vision friendly", "Uses blue and orange plus check and cross marks, not color alone.", !!A.cb, (on) => { X.setA11y({ cb: on }); draw(); }),
        switchRow("Reduce glare (sensitive eyes)", "Use softer warm backgrounds while keeping text easy to read.", !!A.eye, (on) => { X.setA11y({ eye: on }); draw(); }),
        h("label", { style: "margin:10px 0 4px" }, "Text size"),
        h(".seg", [["md", "Normal"], ["lg", "Large"], ["xl", "Extra large"]].map(([k, t]) => h("button.btn.sm" + ((A.fs || "md") === k ? "" : ".alt"), { "aria-pressed": String((A.fs || "md") === k), onclick: () => { X.setA11y({ fs: k }); draw(); } }, t))),
        switchRow("Easy-read font", "A font designed to be easy to tell apart.", !!A.easy, (on) => { X.setA11y({ easy: on }); draw(); }),
        switchRow("Reduce motion", "Fewer animations.", !!A.motion, (on) => { X.setA11y({ motion: on }); draw(); }),
        S.DEMO ? "" : h("div", { style: "border-top:1px solid var(--line);margin-top:10px;padding-top:12px" }, h("h3", "Review the app"), h(".src", { style: "margin:0" }, "How is Ace It working for you? Send feedback any time."), reviewForm(X.classId?.()))),
      h(".card", { style: "margin-top:12px" }, h("h3", "Notifications"),
        switchRow("Reminders and challenges", "Exam countdowns, streak reminders and friend challenges, shown when you open the app.", notifOn(), (on) => { setNotifOn(on); draw(); }, true)),
      S.DEMO ? "" : h(".card", { style: "margin-top:12px" }, h("h3", "Password"), h(".row", { style: "flex-wrap:nowrap" }, pw, h("button.btn.sm", { onclick: async () => { pwMsg.style.color = ""; if (pw.value.length < 8) { pwMsg.textContent = "Use at least 8 characters."; return; } const r = await S.setNewPassword(pw.value); pwMsg.style.color = r.error ? "" : "var(--ok)"; pwMsg.textContent = r.error ? r.error.message : "Password updated."; if (!r.error) pw.value = ""; } }, "Update")), pwMsg),
      S.DEMO ? "" : mfaCard(draw),
      S.DEMO ? "" : h(".card", { style: "margin-top:12px" }, h("h3", "Your data"), h("p", { style: "margin:0 0 8px;color:var(--mute);font-size:.9rem" }, "You own your study data. Download a copy any time."),
        h(".row", h("button.btn.alt.sm", { onclick: () => { const url = URL.createObjectURL(new Blob([JSON.stringify(S.exportData(), null, 2)], { type: "application/json" })); const a = h("a", { href: url, download: "aceit-my-data.json" }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast("Downloaded"); } }, "Download my data"))),
      h(".card", { style: "margin-top:12px" }, h("h3", "Account"), h(".row",
        S.DEMO ? "" : h("button.btn", { onclick: async () => { await S.signOut(); location.hash = "#/"; X.route(); } }, ic("logout", 16), "Log out"),
        S.DEMO ? "" : h("button.btn.alt", { title: "Ends your session on every phone and computer", onclick: async () => { if (!confirm("Log out on every device where you are signed in?")) return; await S.signOut("global"); location.hash = "#/"; X.route(); } }, "Log out everywhere"),
        h("button.btn.alt", { onclick: async () => { if (confirm("Reset all of your progress? This cannot be undone.")) { await S.resetProgress(); toast("Progress reset"); X.route(); } } }, "Reset my progress"))),
      S.isAdmin() && X.adminCard ? X.adminCard() : "",
      h(".card", { style: "margin-top:12px" }, h("h3", "Customer Service"), h("p", { style: "margin:0 0 10px;font-weight:700" }, "What do you need help with?"),
        h(".helpgrid", [["password", "Forgot my password", "Get a link to choose a new one", "lock"], ["hacked", "My account got hacked", "Change your email or delete the account", "shield"], ["delete", "Delete my account", "Permanently, after 22 days", "trash"], ["question", "Ask a question", "Send it to us. We read every one", "mail"]].map(([k, t, d, icn]) =>
          h("button.helpbtn", { onclick: () => (location.hash = "#/help/" + k) }, ic(icn, 20), h("span", t, h("small", d)))))),
      h(".legalrow", h("a", { href: "#/terms" }, "Terms of Service"), h("a", { href: "#/privacy" }, "Privacy Policy")));
  };
  draw();
}
