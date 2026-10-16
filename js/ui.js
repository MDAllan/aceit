export const $ = (s, r = document) => r.querySelector(s);

// tiny hyperscript: h("div.card#id", {attrs}, ...children)
export function h(sel, ...args) {
  const m = sel.match(/^([a-z0-9]*)((?:[.#][\w-]+)*)$/i) || [];
  const el = document.createElement(m[1] || "div");
  (m[2] || "").replace(/([.#])([\w-]+)/g, (_, t, n) => { if (t === ".") el.classList.add(n); else el.id = n; });
  for (const a of args) add(el, a);
  return el;
}
function add(el, a) {
  if (a == null || a === false || a === "") return;
  if (Array.isArray(a)) return a.forEach((x) => add(el, x));
  if (a instanceof Node) return el.append(a);
  if (typeof a === "object") {
    for (const [k, v] of Object.entries(a)) {
      if (k.startsWith("on")) el[k] = v;
      else if (k === "disabled") el.disabled = !!v;
      else el.setAttribute(k, v);
    }
    return;
  }
  el.append(document.createTextNode(String(a)));
}

// safe mini-markdown: **term** highlighted, *italic*; everything else is plain text
export function md(text) {
  const f = document.createDocumentFragment();
  String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).forEach((p) => {
    if (p.startsWith("**")) f.append(h("span.term", p.slice(2, -2)));
    else if (p.startsWith("*") && p.length > 2) f.append(h("em", p.slice(1, -1)));
    else if (p) f.append(document.createTextNode(p));
  });
  return f;
}

let tt;
export function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2200);
}
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
