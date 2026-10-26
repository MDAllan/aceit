// Renders the Terms of Service and the Privacy Policy (the text itself lives in legal-text.js).
// The site uses hash routing, so the table of contents uses buttons that scroll, never href="#..." links.
import { h, md, reducedMotion } from "./ui.js";

export { TERMS_VERSION, TERMS_UPDATED, PRIVACY_VERSION, PRIVACY_UPDATED, TERMS, PRIVACY } from "./legal-text.js";

export const LEGAL_LINKS = { terms: "#/terms", privacy: "#/privacy" };

// ui.js clean() removes sentences and brackets that mention slides, lectures, books or professors (they are for the admin only).
// Text that starts with this invisible mark is left exactly as written, which is what legal text needs.
const AS_WRITTEN = String.fromCharCode(0x2063);
const rich = (text) => md(AS_WRITTEN + text);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function niceDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m || +m[2] < 1 || +m[2] > 12) return String(iso || "");
  return `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}
const slug = (t) => String(t || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// doc: { title, version, updated, intro: string[], sections: [{ id, title, paras: string[], items?: string[] }] }
export function renderLegal(doc) {
  const base = "legal-" + slug(doc.title);
  const secId = (s) => base + "-" + s.id;
  const jump = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    try { el.focus({ preventScroll: true }); } catch (e) { /* focus is a courtesy only */ }
  };
  const para = { style: "margin:.55rem 0;line-height:1.65;max-width:68ch" };
  const toc = h("nav", { "aria-label": "Contents", style: "margin:14px 0;padding:10px 14px;border:1px solid var(--line);border-radius:var(--r-s);background:var(--soft)" },
    h("details", { open: typeof matchMedia === "function" && matchMedia("(min-width:700px)").matches },
      h("summary", { style: "font-weight:700;cursor:pointer;min-height:40px;display:flex;align-items:center" }, `Contents (${doc.sections.length} sections)`),
      h("ol", { style: "list-style:none;margin:0;padding:0" }, doc.sections.map((s, i) =>
        h("li", h("button", {
          type: "button",
          style: "background:none;border:0;padding:6px 0;min-height:36px;text-align:left;font:inherit;color:var(--brand);text-decoration:underline;cursor:pointer",
          onclick: () => jump(secId(s))
        }, `${i + 1}. ${s.title}`))))));
  return h("article.card.legal", { "aria-labelledby": base + "-title", style: "max-width:46rem;margin:0 auto" },
    h("header",
      h("h1", { id: base + "-title", style: "letter-spacing:0;margin:0" }, doc.title),
      h("p", { style: "margin:4px 0 0;color:var(--mute)" }, `Version ${doc.version}, last updated ${niceDate(doc.updated)}`)),
    toc,
    h("div.legal-intro", doc.intro.map((t) => h("p", para, rich(t)))),
    doc.sections.map((s, i) => h("section", { "aria-labelledby": secId(s) },
      h("h2", { id: secId(s), tabindex: "-1", style: "font-size:1.15rem;letter-spacing:0;margin:1.6rem 0 .4rem;scroll-margin-top:72px" }, `${i + 1}. ${s.title}`),
      s.paras.map((t) => h("p", para, rich(t))),
      s.items && s.items.length ? h("ul", { style: "margin:.55rem 0;padding-left:1.3rem;line-height:1.65;max-width:68ch" }, s.items.map((t) => h("li", { style: "margin:.35rem 0" }, rich(t)))) : null)));
}
