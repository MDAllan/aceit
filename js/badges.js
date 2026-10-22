// Badge screens: the profile grid, the detail popup and the "you earned it" celebration.
// All the rules live in badges-core.js (pure, tested in Node); the badges themselves live in badges/badges.json.
import { h, ic, confetti, reducedMotion } from "./ui.js";
import {
  tierImageAlt, shownTier, tileAriaLabel, progressText, badgeTotals, nextGoalText, initials, formatCount, unitLabel,
} from "./badges-core.js";

export {
  SNAPSHOT_KEYS, evaluateBadges, tierImageAlt, validateBadgeConfig, badgeTotals, tileAriaLabel, progressText, nextGoalText,
  formatCount, unitLabel, singular, moreText, shownTier, initials, DEFAULT_CHEER, WAKE_CHEER, DONE_CHEER,
} from "./badges-core.js";

/* ---------- config ---------- */
const EMPTY = () => ({ version: 1, families: [] });
let cfgPromise = null;
// Fetches badges/badges.json once per page load. Never throws: on any problem it gives { version: 1, families: [] }
// (and tries again the next time it is called).
export function loadBadgeConfig() {
  if (!cfgPromise) {
    cfgPromise = fetch("badges/badges.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("badges.json " + r.status))))
      .then((c) => (c && Array.isArray(c.families) ? c : Promise.reject(new Error("badges.json has no families"))))
      .catch((e) => { cfgPromise = null; console.warn("badges: could not load the badge list", e); return EMPTY(); });
  }
  return cfgPromise;
}

// The styles live in css/badges.css. index.html should link it; this is only a safety net.
function ensureStyles() {
  if (document.querySelector('link[href*="badges.css"]')) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = "css/badges.css"; document.head.append(l);
}

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/* ---------- a badge picture (colour when earned, grey when locked, a simple circle if the file is missing) ---------- */
function art(tier, { locked = false, alt = "", size = 0, lazy = false } = {}) {
  const wrap = h("span.bdg-art" + (locked ? ".locked" : ""));
  if (size) wrap.style.setProperty("--sz", size + "px");
  const fallback = () => {
    wrap.classList.add("noimg");
    wrap.append(h("span.bdg-ini", { "aria-hidden": "true" }, initials(tier.name)));
    if (alt) { wrap.setAttribute("role", "img"); wrap.setAttribute("aria-label", alt); }
  };
  if (!tier.image) { fallback(); return wrap; }
  const img = document.createElement("img");
  img.alt = alt; img.decoding = "async"; img.draggable = false;
  if (lazy) img.loading = "lazy";
  img.onerror = () => { img.remove(); fallback(); };
  img.src = tier.image;
  wrap.append(img);
  return wrap;
}

// just the track and the fill (decoration)
function barOnly(frac) {
  const fill = h("i");
  fill.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + "%";
  return h("span.bdg-bar", fill);
}
// a bar that a screen reader can read, with the numbers next to it
function progressBar(frac, { label, now, max, text }) {
  const bar = barOnly(frac);
  for (const [k, v] of Object.entries({ role: "progressbar", "aria-label": label, "aria-valuemin": "0", "aria-valuemax": String(max), "aria-valuenow": String(Math.min(now, max)), "aria-valuetext": text })) bar.setAttribute(k, v);
  return h(".bdg-prog", bar, h("span.bdg-num", text));
}

/* ---------- the grid for the profile ---------- */
// model = evaluateBadges(...). Shows the families that are visible (the starter badges first, in config order).
export function badgesSection(model, snap, { onOpen } = {}) {
  ensureStyles();
  const fams = (model && model.families) || [];
  const shown = fams.filter((f) => f.visible);
  const { earned, total } = badgeTotals(model);
  const hid = nextId("bdg-h");
  const sec = h("section.bdg-sec", { "aria-labelledby": hid }, h("h2", { id: hid }, "Badges"));
  if (!fams.length) { sec.append(h("p.bdg-sum", "Badges will show up here soon.")); return sec; }
  sec.append(h("p.bdg-sum", `${earned} of ${total} earned` + (shown.length < fams.length ? ". More badges appear as you level up." : "")));
  const open = (f) => (typeof onOpen === "function" ? onOpen(f) : openBadge(f, snap));
  sec.append(h("ul.bdg-grid", shown.map((f) => {
    const t = shownTier(f), locked = !f.current;
    const btn = h("button.bdg-tile" + (locked ? ".locked" : ".earned"), { type: "button", "aria-label": tileAriaLabel(f) });
    btn.onclick = () => open(f);
    // Everything inside a tile is decoration: the button's own label already says it all. The numbers ("3 / 7") are drawn by CSS
    // (data-num) so the only text inside the button is the badge name, which the label starts with (WCAG 2.5.3 "label in name").
    const meta = h("span.bdg-meta", { "aria-hidden": "true" },
      h("span.bdg-name", t.name), h("span.bdg-prog", barOnly(f.progress), h("span.bdg-num.gen", { "data-num": progressText(f) })));
    btn.append(art(t, { locked, lazy: true }), meta);
    return h("li", btn);
  })));
  return sec;
}

/* ---------- dialogs (one small helper for the detail popup and the celebration) ---------- */
const stack = [];
let locks = 0;
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function openDialog({ role = "dialog", cls = "", labelId, descId, content, focus }) {
  ensureStyles();
  const opener = document.activeElement;
  const dlg = h(".bdg-dlg" + (cls ? "." + cls : ""), { role, "aria-modal": "true", "aria-labelledby": labelId, tabindex: "-1" }, content);
  if (descId) dlg.setAttribute("aria-describedby", descId);
  const back = h(".bdg-back", dlg);
  const entry = { close, onClose: null };
  let closed = false, down = null;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    back.remove();
    const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
    if (--locks <= 0) { locks = 0; document.body.classList.remove("bdg-lock"); }
    if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    if (entry.onClose) entry.onClose();
  }
  function onKey(e) {
    if (stack[stack.length - 1] !== entry) return; // only the top-most popup listens
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    const items = [...dlg.querySelectorAll(FOCUSABLE)].filter((x) => !x.hidden && x.getClientRects().length);
    if (!items.length) { e.preventDefault(); dlg.focus(); return; }
    const first = items[0], last = items[items.length - 1], at = document.activeElement;
    if (!dlg.contains(at) || at === dlg) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  }
  // a click only closes when it both started and ended on the dimmed backdrop (so dragging a finger off the card does not)
  back.onpointerdown = (e) => { down = e.target; };
  back.onclick = (e) => { if (e.target === back && down === back) close(); down = null; };
  stack.push(entry);
  if (locks++ === 0) document.body.classList.add("bdg-lock");
  document.addEventListener("keydown", onKey, true);
  document.body.append(back);
  (focus ? focus() : dlg).focus({ preventScroll: true });
  return entry;
}

function closeButton(label, onclick) {
  const b = h("button.bdg-x", { type: "button" }, ic("x", 18), label);
  b.onclick = onclick;
  return b;
}

/* ---------- the detail popup ---------- */
// family = one entry of evaluateBadges(...).families. snap is only used if the family has no value of its own.
export function openBadge(family, snap) {
  const f = family;
  if (!f || !Array.isArray(f.tiers) || !f.tiers.length) return null;
  const value = typeof f.value === "number" ? f.value : Number(snap && snap[f.metric]) || 0;
  const titleId = nextId("bdg-t");
  const defIdx = f.current ? f.current.index : 0; // the picture shown at first: the best earned tier, or the first tier
  let sel = defIdx;

  const hero = h(".bdg-hero");
  const title = h("h2.bdg-title", { id: titleId });
  const status = h("p.bdg-status");
  const how = h("p.bdg-how");
  const prog = h(".bdg-progwrap");
  const cheer = h("p.bdg-cheer");
  const detail = h(".bdg-detail", { "aria-live": "polite" }, status, how, prog, cheer);
  const steps = [];

  function paint() {
    const t = f.tiers[sel], def = sel === defIdx;
    hero.replaceChildren(art(t, { locked: !t.earned, alt: tierImageAlt(f, t) }));
    title.textContent = t.name;
    status.replaceChildren(
      h("span.bdg-chip.rank", `${t.rank} rank`),
      t.earned ? h("span.bdg-chip.ok", ic("check", 14), "Earned") : h("span.bdg-chip", ic("lock", 14), "Locked"));
    const sx = f.suffix || "";
    if (def) {
      how.textContent = f.next ? `Next goal: ${f.next.how}` : "You have unlocked every tier";
      prog.replaceChildren(f.next
        ? progressBar(f.progress, { label: `Progress toward ${f.next.name}`, now: value, max: f.next.at, text: progressText(f) })
        : progressBar(1, { label: `${f.name} badge complete`, now: 1, max: 1, text: "Complete" }));
      cheer.textContent = f.cheer;
    } else if (t.earned) {
      how.textContent = `Earned: ${t.how}`;
      prog.replaceChildren(progressBar(1, { label: `${t.name} earned`, now: 1, max: 1, text: "Earned" }));
      cheer.textContent = "You earned this one. Nice work!";
    } else {
      const left = Math.max(0, Math.ceil(t.at - value));
      how.textContent = `How to unlock: ${t.how}`;
      prog.replaceChildren(progressBar(Math.min(1, value / t.at), { label: `Progress toward ${t.name}`, now: value, max: t.at, text: `${formatCount(Math.min(value, t.at))}${sx} / ${formatCount(t.at)}${sx}` }));
      cheer.textContent = `${formatCount(left)} more ${unitLabel(f, left)} to unlock ${t.name}.`;
    }
    steps.forEach((b, i) => b.setAttribute("aria-pressed", i === sel ? "true" : "false"));
  }

  const ladder = h("ol.bdg-ladder", f.tiers.map((t, i) => {
    const b = h("button.bdg-step" + (t.earned ? ".earned" : ".locked"), { type: "button", "aria-pressed": "false", "aria-label": `${t.name}, ${t.how}, ${t.rank} rank, ${t.earned ? "earned" : "locked"}` });
    b.onclick = () => { sel = i; paint(); };
    b.append(
      h("span.bdg-stepart", art(t, { locked: !t.earned, size: 52 }), t.earned ? h("span.bdg-tick", { "aria-hidden": "true" }, ic("check", 12)) : ""),
      h("span.bdg-step-name", t.name), " ", h("span.bdg-step-how", t.how)); // the space keeps the two texts apart for tools that read the button text
    steps.push(b);
    return h("li", b);
  }));

  const x = closeButton("Close", () => entry.close());
  const entry = openDialog({
    cls: "bdg-detail-dlg", labelId: titleId,
    content: [
      h(".bdg-dhead", h("p.bdg-eyebrow", `${f.name} badge`), x),
      hero, title, detail,
      h("h3.bdg-lh", "All the steps"), ladder,
    ],
    focus: () => x,
  });
  paint();
  return entry;
}

/* ---------- the celebration ---------- */
const queue = [];
const waiting = [];
let running = false;

// fresh = evaluateBadges(...).fresh; model = the same evaluation. One popup per newly earned tier, one after another.
// Resolves when every popup has been closed.
export function celebrate(fresh, model) {
  const items = (fresh || []).filter((x) => x && x.family && x.tier);
  if (!items.length) return Promise.resolve();
  items.forEach((it, i) => queue.push({ it, model, n: i + 1, of: items.length }));
  return new Promise((resolve) => { waiting.push(resolve); if (!running) next(); });
}

function next() {
  const e = queue.shift();
  if (!e) { running = false; waiting.splice(0).forEach((r) => r()); return; }
  running = true;
  show(e);
}

function show({ it, model, n, of }) {
  // use the newest state of the family when we have it (the numbers in "Next:" must be current)
  const f = ((model && model.families) || []).find((x) => x.id === it.family.id) || it.family;
  const t = f.tiers[it.tier.index] || it.tier;
  const titleId = nextId("bdg-c"), descId = nextId("bdg-d");
  const calm = reducedMotion();
  const ok = h("button.btn.bdg-ok", { type: "button" }, "Nice!");
  ok.onclick = () => entry.close();
  const skip = queue.length ? h("button.bdg-skip", { type: "button" }, "Skip the rest") : null;
  if (skip) skip.onclick = () => { queue.length = 0; entry.close(); };
  const entry = openDialog({
    role: "alertdialog", cls: "bdg-cele", labelId: titleId, descId,
    content: [
      of > 1 ? h("p.bdg-eyebrow", `Badge ${n} of ${of}`) : "",
      h(".bdg-hero.bdg-glow" + (calm ? "" : ".bdg-popin"), art(t, { alt: tierImageAlt(f, t) })),
      h("h2.bdg-title", { id: titleId }, `Congrats! You've earned the ${t.name} badge!`),
      h(".bdg-desc", { id: descId }, h("p.bdg-status", h("span.bdg-chip.rank", `${t.rank} rank`)), h("p.bdg-how", nextGoalText(f, t))),
      h(".bdg-actions", ok, skip),
    ],
    focus: () => ok,
  });
  entry.onClose = () => setTimeout(next, reducedMotion() ? 0 : 220);
  if (!calm) confetti(36);
}
