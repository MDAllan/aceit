import { canSeeRefs } from "./store.js";

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
      else if (k === "disabled" || k === "selected" || k === "checked") el[k] = !!v;
      else el.setAttribute(k, v);
    }
    return;
  }
  el.append(document.createTextNode(String(a)));
}

/* ---------- student-safe text ---------- */
// Slide numbers, textbook sections and "outside source" notes are for the admin only.
export function clean(t) {
  if (canSeeRefs()) return String(t);
  const N = String.raw`\d+(?:\s*[-–,&]\s*\d+|\s+and\s+\d+)*`;
  return String(t)
    .replace(new RegExp(String.raw`^(?:Slides?|Textbook|Sed|Weathering)\s+${N}[.\d]*\s*(?:and\s+[^:]{0,30})?:\s*`, "i"), "")
    .replace(/\s*\((?:[^()]*?(?:[Tt]extbook|[Ss]lides?\b|outside source|[Ss]ed \d|[Ww]eathering \d|prof)[^()]*)\)/g, "")
    .replace(new RegExp(String.raw`\b[Ss]lides? ${N}`, "g"), "the lecture")
    .replace(/\b(?:from )?[Tt]extbook \d[\d.]*(?:\s*[-–,]\s*\d[\d.]*)*/g, "the textbook")
    .replace(/\b([Tt])he slides?\b/g, (m, c) => c + "he lecture")
    .replace(/\bthe the\b/gi, "the")
    .replace(/\s*\(outside source\)/gi, "")
    .replace(/\bthe lecture(?: the lecture)+/g, "the lecture")
    .replace(/\s{2,}/g, " ").trim()
    .replace(/^the lecture/, "The lecture");
}

// safe mini-markdown: **term** highlighted, *italic*; everything else is plain text
export function md(text) {
  const f = document.createDocumentFragment();
  clean(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).forEach((p) => {
    if (p.startsWith("**")) f.append(h("span.term", p.slice(2, -2)));
    else if (p.startsWith("*") && p.length > 2) f.append(h("em", p.slice(1, -1)));
    else if (p) f.append(document.createTextNode(p));
  });
  return f;
}

/* ---------- icons (one consistent stroke style) ---------- */
const P = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  cards: "M4 7h13a2 2 0 012 2v9a2 2 0 01-2 2H4zM8 7V5a2 2 0 012-2h9a2 2 0 012 2v9",
  quiz: "M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z",
  notes: "M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2zM8 7h6M8 11h6",
  games: "M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 00-4 4.3l.8 6a3 3 0 005 1.2L9 15h6l.5 1.5a3 3 0 005-1.2l.8-6a4 4 0 00-4-4.3z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  moon: "M21 13A9 9 0 1111 3a7 7 0 0010 10z",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  down: "M5 9l7 7 7-7",
  up: "M5 15l7-7 7 7",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z",
  brain: "M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V4a3 3 0 00-3 0zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 0",
  alert: "M12 3l10 18H2zM12 10v5M12 18h.01",
  zoom: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5M11 8v6M8 11h6",
  x: "M6 6l12 12M18 6L6 18",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  fire: "M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  logout: "M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 8l4 4-4 4M20 12H9",
};
export function ic(name, size = 20) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size);
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2");
  s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", P[name] || P.star); s.append(p);
  return s;
}

/* ---------- toasts, shuffle, confetti ---------- */
let tt;
export function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2200);
}
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function confetti(n = 90) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = h("canvas.confetti"); c.width = innerWidth; c.height = innerHeight; document.body.append(c);
  const g = c.getContext("2d"), cols = ["#2563eb", "#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];
  const ps = Array.from({ length: n }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.4, r: 4 + Math.random() * 6, vx: -2 + Math.random() * 4, vy: 3 + Math.random() * 4, a: Math.random() * 6, c: cols[(Math.random() * cols.length) | 0] }));
  let f = 0;
  (function tick() {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.a += 0.15; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
    if (++f < 130) requestAnimationFrame(tick); else c.remove();
  })();
}
export const pick = (a, n) => shuffle(a.slice()).slice(0, n);
