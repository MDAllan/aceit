// Customer Service: forgot password, a hacked account (change email or delete), delete my account, ask a question.
import * as S from "./store.js";
import * as A from "./account.js";
import { h, ic, toast } from "./ui.js";

const when = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
const TOPICS = ["Something is not working", "A mistake in the course content", "My account", "A suggestion", "Something else"];

export function viewHelp(v, topic, X) {
  const to = (k) => (location.hash = k ? "#/help/" + k : "#/help");
  const back = (label = "Customer Service", hash = "#/help") => h("button.chip", { style: "margin-top:8px", onclick: () => (location.hash = hash) }, ic("left", 14), label);
  const email = S.session?.user?.email || (S.DEMO ? "student@example.com" : "");
  const page = (title, intro, ...kids) => v.append(back(topic ? "Customer Service" : "Profile", topic ? "#/help" : "#/profile"), h(".hero", h("h1", title), intro ? h("p", intro) : ""), ...kids);

  if (!topic) return hub();
  if (topic === "password") return password();
  if (topic === "hacked") return hacked();
  if (topic === "email") return changeEmail();
  if (topic === "delete") return deleteAccount();
  if (topic === "question") return question();
  return hub();

  function hub() {
    const mine = h("div");
    page("Customer Service", "What do you need help with?",
      h(".helpgrid", [["password", "Forgot my password", "Get a link to choose a new one", "lock"], ["hacked", "My account got hacked", "Change your email or delete the account", "shield"], ["delete", "Delete my account", "Permanently, after 22 days", "trash"], ["question", "Ask a question", "Send it to us. We read every one", "mail"]].map(([k, t, d, icn]) =>
        h("button.helpbtn", { onclick: () => to(k) }, ic(icn, 20), h("span", t, h("small", d))))), mine);
    A.myQuestions().then((r) => {
      if (!r.data.length) return;
      mine.append(h("h2", { style: "margin-top:20px" }, "Your questions"), ...r.data.map((q) => h(".card", { style: "margin-top:8px" }, h(".row", { style: "justify-content:space-between;flex-wrap:nowrap" }, h("b", q.topic), h("span.pill" + (q.status === "answered" ? ".ok" : q.status === "closed" ? ".mute" : ""), q.status === "answered" ? "Answered" : q.status === "closed" ? "Closed" : "Waiting")),
        h(".src", { style: "margin:2px 0 6px" }, when(q.at)), h("p", { style: "margin:0;white-space:pre-wrap" }, q.message), q.admin_note ? h(".fb", { style: "margin-top:8px" }, h("b", "Reply: "), q.admin_note) : "")));
    });
  }

  function password() {
    const out = h("div", { "aria-live": "polite" }), go = h("button.btn", "Email me a reset link");
    go.onclick = async () => {
      go.disabled = true; const r = await A.sendReset(email);
      if (r.error) { out.replaceChildren(h("p.err", r.error.message)); go.disabled = false; return; }
      out.replaceChildren(h(".warnbox.good", h("b", "Check your email."), h("p", { style: "margin:4px 0 0" }, `We sent a link to ${email}. It works for a limited time, so use it soon. If you do not see it, look in your spam folder.`)));
      setTimeout(() => { go.disabled = false; }, 60000);
    };
    page("Forgot my password", "We will email you a secure link to choose a new password.",
      h(".card", h("ol.steps", h("li", `Tap the button. We email a link to ${email || "your email"}.`), h("li", "Open the email and tap the link. It only works for a limited time."), h("li", "Choose a new password on the page that opens.")), go, out));
  }

  function hacked() {
    page("My account got hacked", "Choose what you want to do. Do these as soon as you can.",
      h(".helpgrid", h("button.helpbtn", { onclick: () => to("email") }, ic("mail", 20), h("span", "Change my email", h("small", "Use a new address that only you can open"))),
        h("button.helpbtn", { onclick: () => to("delete") }, ic("trash", 20), h("span", "Delete my account", h("small", "Gone permanently after 22 days"))),
        h("button.helpbtn", { onclick: () => to("password") }, ic("lock", 20), h("span", "Choose a new password", h("small", "A reset link goes to your email")))),
      h(".card", { style: "margin-top:14px" }, h("b", "Also sign out everywhere"), h("p", { style: "margin:4px 0 8px;color:var(--mute)" }, "This ends the session on every phone and computer, including anyone else who may be in."),
        h("button.btn.alt", { onclick: async () => { if (S.DEMO) { toast("Demo only"); return; } if (!confirm("Log out on every device where you are signed in?")) return; await S.signOut("global"); location.hash = "#/"; X.route(); } }, "Log out everywhere")));
  }

  function changeEmail() {
    let how = "password", verified = false;
    const box = h("div");
    const draw = () => {
      box.replaceChildren();
      if (!verified) {
        const err = h("p.err", { role: "alert", style: "margin:4px 0 0;min-height:0" });
        const pw = h("input", { type: "password", autocomplete: "current-password", placeholder: "Your password", "aria-label": "Your password" });
        const code = h("input", { inputmode: "numeric", autocomplete: "one-time-code", placeholder: "Code from the email", "aria-label": "Code from the email" });
        const sent = { v: false };
        const body = how === "password"
          ? [h("label", { for: "ce-pw" }, "Your password"), Object.assign(pw, { id: "ce-pw" }), err, h("button.btn", { style: "margin-top:10px", onclick: async (e) => { e.target.disabled = true; const r = await A.checkPassword(pw.value); e.target.disabled = false; if (r.error) { err.textContent = r.error.message; return; } verified = true; draw(); } }, "Continue")]
          : [h("p", { style: "margin:0 0 8px" }, `We will email a code to ${email}.`), h("button.btn.alt", { onclick: async (e) => { e.target.disabled = true; const r = await A.sendEmailCode(); e.target.disabled = false; if (r.error) { err.textContent = r.error.message; return; } sent.v = true; err.style.color = "var(--ok)"; err.textContent = "Code sent. Check your email."; } }, "Email me a code"),
            h("label", { for: "ce-code" }, "Code"), Object.assign(code, { id: "ce-code" }), err, h("button.btn", { style: "margin-top:10px", onclick: async (e) => { e.target.disabled = true; const r = await A.checkEmailCode(code.value.trim()); e.target.disabled = false; err.style.color = ""; if (r.error) { err.textContent = r.error.message; return; } verified = true; draw(); } }, "Continue")];
        box.append(h("h3", "Step 1: confirm it is you"), h(".seg", { style: "grid-template-columns:1fr 1fr;margin-bottom:6px" }, [["password", "Use my password"], ["code", "Email me a code"]].map(([k, t]) => h("button.btn.sm" + (how === k ? "" : ".alt"), { "aria-pressed": String(how === k), onclick: () => { how = k; draw(); } }, t))), ...body);
      } else {
        const err = h("p.err", { role: "alert", style: "margin:4px 0 0;min-height:0" }), ne = h("input", { type: "email", id: "ce-new", autocomplete: "email", placeholder: "new@email.com", "aria-label": "New email address" });
        box.append(h("h3", "Step 2: your new email"), h("label", { for: "ce-new" }, "New email address"), ne, err,
          h("button.btn", { style: "margin-top:10px", onclick: async (e) => {
            const v2 = ne.value.trim().toLowerCase(); err.style.color = "";
            if (!/^[^@\s]+@[^@\s]+[.][^@\s]+$/.test(v2)) { err.textContent = "That does not look like an email address."; return; }
            if (v2 === email.toLowerCase()) { err.textContent = "That is already your email."; return; }
            e.target.disabled = true; const r = await A.changeEmail(v2); e.target.disabled = false;
            if (r.error) { err.textContent = r.error.message; return; }
            box.replaceChildren(h(".warnbox.good", h("b", "Almost done."), h("p", { style: "margin:4px 0 0" }, `We sent a confirmation link to ${v2}. Your email changes when you open it. Until then your current email still works. If you were asked, confirm on your old email too.`)));
          } }, "Update my email"));
      }
    };
    draw();
    page("Change my email", "Use an address that only you can open.", h(".card", box));
  }

  function deleteAccount() {
    if (S.profile?.is_admin) return page("Delete my account", "", h(".warnbox.bad", h("b", "Admin accounts cannot be deleted here."), h("p", { style: "margin:4px 0 0" }, "Ask another admin to remove your admin role first.")));
    const ok = h("input", { type: "checkbox", id: "del-ok" }), go = h("button.btn.warn", { disabled: true }, "Delete my account in 22 days");
    ok.onchange = () => { go.disabled = !ok.checked; };
    go.onclick = async () => {
      go.disabled = true; const r = await A.requestDeletion();
      if (r.error) { toast(r.error.message); go.disabled = false; return; }
      const d = r.data.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      v.replaceChildren(h(".hero", h("h1", "Deletion scheduled")), h(".card", h("p", { style: "margin-top:0" }, `Your account will be permanently deleted on ${d}.`), h("p", "You have been signed out. If you change your mind, log in again with the same email before that date and the deletion is cancelled."),
        h("button.btn", { onclick: () => { location.hash = "#/"; X.route(); } }, "OK")));
    };
    page("Delete my account", "Please read this first.",
      h(".card", h("p", { style: "margin-top:0" }, h("b", "Your account will be permanently deleted in 22 days.")),
        h("ul", { style: "margin:0 0 10px;padding-left:20px" }, h("li", "We sign you out now and start a 22-day countdown."), h("li", "If you log in again with the same email within those 22 days, the deletion is cancelled and your account is restored exactly as it was."), h("li", "After 22 days everything is deleted for good: your profile, progress, badges and class memberships. It cannot be undone."), h("li", "Questions you sent to Customer Service may be kept as described in the Privacy Policy.")),
        h("label.check", ok, "I understand and want to delete my account"), go),
      h("p", { style: "text-align:center" }, h("a", { href: "#/help/hacked" }, "My account was hacked instead")));
  }

  function question() {
    const topicSel = h("select", { id: "q-topic", "aria-label": "What is this about?" }, TOPICS.map((t) => h("option", { value: t }, t)));
    const msg = h("textarea", { id: "q-msg", rows: 6, maxlength: 2000, placeholder: "Write your question here", "aria-label": "Your question" });
    const count = h(".src", { style: "margin:2px 0 0;text-align:right" }, "0 / 2000"), err = h("p.err", { role: "alert", style: "margin:4px 0 0;min-height:0" });
    msg.oninput = () => { count.textContent = `${msg.value.length} / 2000`; };
    const go = h("button.btn", { style: "margin-top:10px" }, "Send question");
    go.onclick = async () => {
      const m = msg.value.trim(); err.textContent = "";
      if (m.length < 5) { err.textContent = "Write a little more so we can help (at least 5 characters)."; return; }
      go.disabled = true; const r = await A.askQuestion(topicSel.value, m); go.disabled = false;
      if (r.error) { err.textContent = /too many/i.test(r.error.message) ? "You have sent a few questions today. Please try again tomorrow." : r.error.message; return; }
      v.replaceChildren(back(), h(".hero", h("h1", "Thank you")), h(".card", h("p", { style: "margin-top:0" }, "We got your question and will read it soon. You can see our reply under Customer Service, in Your questions."), h("button.btn", { onclick: () => to("") }, "Back to Customer Service")));
    };
    page("Ask a question", "Tell us what you need. Please do not include your password.", h(".card", h("label", { for: "q-topic", style: "margin-top:0" }, "What is it about?"), topicSel, h("label", { for: "q-msg" }, "Your question"), msg, count, err, go));
  }
}
