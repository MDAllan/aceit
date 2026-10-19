// Small pieces shared by the Workspace screens (staff.js and author.js): dates, form fields, panels, buttons, empty states.
import { h, ic, toast } from "./ui.js";

export const DAY = 864e5;
export const ago = (t) => { if (!t) return "has not opened ACEIT yet"; const d = Math.floor((Date.now() - new Date(t)) / DAY); return d <= 0 ? "active today" : d === 1 ? "active yesterday" : d < 30 ? `active ${d} days ago` : "active " + new Date(t).toLocaleDateString(); };
export const when = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-");
export const quiet = (t) => !t || Date.now() - new Date(t) > 7 * DAY;
export const plural = (n, w, many) => `${n} ${n === 1 ? w : many || w + "s"}`;
export const site = () => location.origin + location.pathname;
export const initials = (n) => (n || "?").trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
export const nameOf = (r) => r.display_name || r.name || (r.email || "").split("@")[0] || "Unknown";
export const meter = (pct, tc) => h(".mastery", { style: tc ? `--tc:${tc}` : "", role: "img", "aria-label": pct + " percent" }, h("i", { style: `width:${Math.max(0, Math.min(100, pct || 0))}%` }), h("span", (pct || 0) + "%"));
export const csvCell = (t) => { let s = String(t ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; }; // a leading = + - @ would run as a formula in Excel
export async function copy(text, msg = "Copied") { try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt("Copy this:", text); } }
export const field = (label, input, help) => h(".field", h("label", label), input, help ? h(".src", help) : "");
export const panel = (title, open, ...kids) => { const d = h("details.card.panel", { style: "margin-top:12px" }, h("summary", title), h("div", { style: "margin-top:10px" }, ...kids)); if (open) d.open = true; return d; };
export const busy = async (btn, fn) => { btn.disabled = true; try { return await fn(); } finally { btn.disabled = false; } };
export const go = (p) => { location.hash = "#/work" + (p ? "/" + p : ""); };
export const tile = (label, value, sub) => h(".tile", h("b", String(value ?? 0)), h("span", label), sub ? h("small", sub) : "");
export const empty = (msg) => h(".card.empty", msg);
export const warn = (...kids) => h(".warnbox", ...kids);
export const crumb = (label, to) => h("button.crumb", { onclick: () => go(to) }, ic("left", 16), label);
export const loading = (v) => { const p = h("p.boot", "Loading..."); v.append(p); return () => p.remove(); };
export const fail = (v, e) => v.append(h(".card", h("p.err", e.message || String(e))));
