// Badge screens: the profile grid, the detail popup and the "you earned it" celebration.
// All the rules live in badges-core.js (pure, tested in Node); the badges themselves live in badges/badges.json.
import { h, ic, confetti, reducedMotion } from "./ui.js";
import { tierImageAlt, shownTier, badgeTotals, nextGoalText, initials, formatCount, tileLine, badgeTitle } from "./badges-core.js";

export {
  SNAPSHOT_KEYS, TIER_NAMES, evaluateBadges, tierImageAlt, validateBadgeConfig, badgeTotals, badgeTitle, tileLine, progressText, nextGoalText,
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
function art(tier, { locked = false, alt = "", size = 0, lazy = false, ini = "" } = {}) {
  const wrap = h("span.bdg-art" + (locked ? ".locked" : ""));
  if (size) wrap.style.setProperty("--sz", size + "px");
  const fallback = () => {
    wrap.classList.add("noimg");
    wrap.append(h("span.bdg-ini", { "aria-hidden": "true" }, initials(ini || tier.name)));
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
// model = evaluateBadges(...). One tile per family that is visible (the six starters first, then the others as the person levels up).
// A tile shows the highest tier earned (in colour), or the first tier in grey while nothing is earned, and under it one short line:
//   locked:  "Share a game with a friend to unlock"
//   earned:  a thin progress bar and "4 more shares to unlock Silver"
//   last:    "Max level reached"
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
    const t = shownTier(f), locked = !f.current, line = tileLine(f);
    const btn = h("button.bdg-tile" + (locked ? ".locked" : ".earned"), { type: "button" });
    btn.onclick = () => open(f);
    // the picture is decoration (its name is the text next to it); the words are the button's name
    btn.append(
      art(t, { locked, lazy: true, ini: f.name }),
      h("span.bdg-name", h("span.sr", locked ? "Locked: " : "Unlocked: "), f.name),
      !locked && t.name ? h("span.bdg-tier", t.name) : "",
      line.kind === "progress" ? barOnly(f.progress) : "",
      h("span.bdg-line." + line.kind, line.text));
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
// Shows the badge name and current tier, how to unlock the next tier, and a small picture for every tier (colour = earned, grey = locked).
export function openBadge(family, snap) {
  const f = family;
  if (!f || !Array.isArray(f.tiers) || !f.tiers.length) return null;
  const value = typeof f.value === "number" ? f.value : Number(snap && snap[f.metric]) || 0;
  const titleId = nextId("bdg-t");
  const t = shownTier(f), locked = !f.current;
  const next = f.next, sx = f.suffix || "";

  const status = h("p.bdg-status",
    f.current && f.current.name ? h("span.bdg-chip.tier", f.current.name) : "",
    locked ? h("span.bdg-chip", ic("lock", 14), "Locked") : h("span.bdg-chip.ok", ic("check", 14), next ? "Unlocked" : "Max level"));
  const goal = h(".bdg-goal");
  if (next) {
    goal.append(
      h("p.bdg-next", next.name ? `Next: ${next.name}` : "How to unlock"),
      h("p.bdg-how", next.how),
      progressBar(f.progress, { label: `Progress toward ${next.name || f.name}`, now: value, max: next.at, text: `${formatCount(Math.min(value, next.at))}${sx} / ${formatCount(next.at)}${sx}` }),
      h("p.bdg-cheer", f.cheer));
  } else goal.append(h("p.bdg-next", "Max level reached"), h("p.bdg-cheer", f.cheer));

  const row = h("ul.bdg-tiers", { "aria-label": `All ${f.name} tiers` }, f.tiers.map((x) => h("li" + (x.earned ? ".earned" : ".locked"),
    h("span.bdg-tierart", art(x, { locked: !x.earned, size: 48, ini: f.name, alt: tierImageAlt(f, x) + (x.earned ? ", unlocked" : ", locked") }), x.earned ? h("span.bdg-tick", { "aria-hidden": "true" }, ic("check", 12)) : ""),
    h("span.bdg-tiername", x.name || f.name))));

  const x = closeButton("Close", () => entry.close());
  const entry = openDialog({
    cls: "bdg-detail-dlg", labelId: titleId,
    content: [
      h(".bdg-dhead", h("p.bdg-eyebrow", "Badge"), x),
      h(".bdg-hero", art(t, { locked, ini: f.name, alt: tierImageAlt(f, t) + (locked ? ", locked" : "") })),
      h("h2.bdg-title", { id: titleId }, f.name), status, goal,
      h("h3.bdg-lh", f.tiers.length > 1 ? "All tiers" : "This badge"), row,
    ],
    focus: () => x,
  });
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
      h(".bdg-hero.bdg-glow" + (calm ? "" : ".bdg-popin"), art(t, { ini: f.name, alt: tierImageAlt(f, t) })),
      h("h2.bdg-title", { id: titleId }, `Congrats! You've earned ${badgeTitle(f, t)}!`),
      h(".bdg-desc", { id: descId }, h("p.bdg-how", nextGoalText(f, t))),
      h(".bdg-actions", ok, skip),
    ],
    focus: () => ok,
  });
  entry.onClose = () => setTimeout(next, reducedMotion() ? 0 : 220);
  if (!calm) confetti(36);
}
