// Two-step login with an authenticator app: the code screen after the password, setting it up, and the profile card.
import * as S from "./store.js";
import { h, ic, toast } from "./ui.js";

const wrong = (e) => (/invalid|incorrect|expired/i.test(e.message || "") ? "That code isn't right. Check the app and try again." : e.message);
const codeInput = () => h("input", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: 7, placeholder: "123456", "aria-label": "6-digit code", style: "text-align:center;font:700 1.4rem Lexend,monospace;letter-spacing:.3em" });

// the second step at sign-in
export function challengeBody(done) {
  const code = codeInput(), err = h("p.err", { role: "alert" }), go = h("button.btn", { style: "width:100%;margin-top:14px" }, "Verify");
  const submit = async () => {
    err.textContent = ""; go.disabled = true;
    const f = (await S.mfa.factors())[0];
    if (!f) { err.textContent = "No authenticator app was found on this account."; go.disabled = false; return; }
    const r = await S.mfa.confirm(f.id, code.value);
    if (r.error) { err.textContent = wrong(r.error); go.disabled = false; code.select(); return; }
    await S.loadProfile(); done();
  };
  go.onclick = submit; code.onkeydown = (e) => { if (e.key === "Enter") submit(); };
  return [h("p", "Open your authenticator app and enter the 6-digit code for ACEIT."), code, err, go];
}

// set up an authenticator app: a QR code and a key, then one code to prove it works
export function enrollBody(done) {
  const box = h("div"), err = h("p.err", { role: "alert" }), begin = h("button.btn", "Set up authenticator app");
  begin.onclick = async () => {
    begin.disabled = true; err.textContent = "";
    const r = await S.mfa.start();
    if (r.error) { err.textContent = r.error.message; begin.disabled = false; return; }
    const { id, totp } = r.data, code = codeInput(), go = h("button.btn", { style: "margin-top:10px" }, "Turn on");
    go.onclick = async () => {
      go.disabled = true; err.textContent = "";
      const v = await S.mfa.confirm(id, code.value);
      if (v.error) { err.textContent = wrong(v.error); go.disabled = false; return; }
      toast("Two-step login is on"); await S.loadProfile(); done();
    };
    code.onkeydown = (e) => { if (e.key === "Enter") go.click(); };
    box.replaceChildren(
      h("p", { style: "margin:0 0 8px" }, "1. Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy) and scan this code."),
      h("img", { src: totp.qr_code, alt: "QR code for your authenticator app", width: 200, height: 200, style: "background:#fff;padding:8px;border:1px solid var(--line);border-radius:10px" }),
      h(".src", "Cannot scan it? Type this key into the app instead:"), h("code", { style: "word-break:break-all;display:block;margin:4px 0 12px;font-weight:700" }, totp.secret),
      h("p", { style: "margin:0 0 6px" }, "2. Enter the 6-digit code the app shows."), code, go, err);
  };
  box.append(begin, err);
  return box;
}

// the card on the profile page
export function mfaCard(redraw) {
  const card = h(".card", { style: "margin-top:12px" }, h("h3", "Two-step login"), h(".src", "Loading..."));
  S.mfa.factors().then((list) => {
    const staff = S.isStaff();
    card.replaceChildren(h("h3", "Two-step login"), ...(list.length
      ? [h("p", { style: "margin:0 0 8px" }, ic("check", 16), " On. An authenticator app protects this account."),
        S.mfaRequired && staff ? h(".src", "Your school requires this for staff, so it cannot be turned off.") : h("button.btn.alt.sm", { onclick: async () => { if (!confirm("Turn off two-step login for this account?")) return; const r = await S.mfa.remove(list[0].id); toast(r.error ? r.error.message : "Two-step login is off"); await S.loadProfile(); redraw(); } }, "Turn off")]
      : [h(".src", { style: "margin:0 0 8px" }, staff ? "Recommended for instructors, school managers and admins: after your password, a code from your phone is needed. It protects your students' information." : "Optional extra protection: after your password, a code from your phone is needed."), enrollBody(redraw)]));
  });
  return card;
}
