// The glossary of one class: terms, vocabulary and names only (rules in glossaryrules.js). Each class shows only its own terms.
import * as S from "./store.js";
import { h, md, ic, reducedMotion } from "./ui.js";
import { glossaryFor, letterOf } from "./glossaryrules.js";

// v: the screen, cls: the class (its name is shown, never a switch), lectures: that class's lectures
export function viewGlossary(v, { cls, lectures, extra }) {
  const all = glossaryFor(lectures);
  const inp = h("input", { type: "search", placeholder: "Find a term", "aria-label": "Find a term", autocomplete: "off" }), list = h("div"), letters = h(".swipe", { role: "navigation", "aria-label": "Jump to a letter" });
  const seen = () => S.stats().glossSeen || {};
  const draw = () => {
    const q = inp.value.trim().toLowerCase(); list.replaceChildren(); let last = "", shown = new Set();
    const rows = all.filter(({ term, def }) => !q || (term + " " + def).toLowerCase().includes(q));
    rows.forEach(({ lec, card, term, def }) => {
      const L = letterOf(term); shown.add(L);
      if (L !== last) { last = L; list.append(h("h3.gl-letter", { id: "gl-" + (L === "#" ? "num" : L) }, L)); }
      const open = h(".body", h("div", h(".def", md(def), h(".src", { style: "margin:6px 0 0" }, lec.title))));
      const el = h(".acc.gl" + (seen()[card.id] ? ".seen" : ""), h("button", { "aria-expanded": "false" }, h("span.term-t", term), seen()[card.id] ? h("span.src", { style: "margin:0" }, ic("check", 14)) : "", h("span.chev", ic("down", 18))), open);
      el.firstChild.onclick = () => {
        const o = el.classList.toggle("open"); el.firstChild.setAttribute("aria-expanded", o);
        if (o && S.mark("glossSeen", card.id)) el.classList.add("seen"); // opening a term counts as studying it
      };
      list.append(el);
    });
    if (!rows.length) list.append(h(".empty", all.length ? "No matching terms." : "This class has no glossary terms yet."));
    letters.replaceChildren(...[...shown].map((L) => h("button.chip", { "aria-label": "Jump to " + L, onclick: () => document.getElementById("gl-" + (L === "#" ? "num" : L))?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }) }, L)));
    letters.hidden = q.length > 0 || shown.size < 2;
  };
  inp.oninput = draw;
  v.append(h(".hero", h("h1", "Glossary"), h("p", `${all.length} term${all.length === 1 ? "" : "s"} in ${cls.name}, A to Z. Tap a term to see what it means.`)), extra || "", inp, letters, list); draw();
}
