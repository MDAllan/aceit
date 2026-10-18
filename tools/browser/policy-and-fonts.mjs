// The page loads nothing from other websites, the content security policy blocks nothing the app needs, and the fonts are served by the site itself.
import { launch, SHOTS } from "./common.mjs";
const b = await launch();
const p = await b.newPage(); const msgs = [], ext = [], fonts = [];
let bad = 0; const chk = (name, ok, extra = "") => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };
p.on("console", (m) => msgs.push(m.type() + ": " + m.text().slice(0, 200)));
p.on("pageerror", (e) => msgs.push("PAGEERR " + e.message));
p.on("request", (r) => { const u = r.url(); if (!/^(http:\/\/localhost:8765|data:|blob:)/.test(u)) ext.push(u); if (/\.woff2/.test(u)) fonts.push(u.split("/").pop()); });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
await p.goto("http://localhost:8765/?demo#/s/astr207", { waitUntil: "networkidle0" }); await new Promise((r) => setTimeout(r, 800));
const info = await p.evaluate(async () => { await document.fonts.ready; return { lexend: document.fonts.check("600 20px Lexend"), nunito: document.fonts.check("400 16px Nunito"), csp: document.querySelector("meta[http-equiv=Content-Security-Policy]")?.content || "" }; });
chk("fonts come from the site", info.lexend && info.nunito && fonts.length >= 2, fonts.join(", "));
chk("nothing is loaded from other websites", ext.length === 0, ext.join(" "));
chk("a content security policy is set and forbids outside scripts", /script-src 'self'/.test(info.csp) && !/https?:\/\/(?!rhxmzqjdysdslurdwocj)/.test(info.csp.replace("https://rhxmzqjdysdslurdwocj.supabase.co", "")), info.csp.slice(0, 80));
chk("the policy blocks nothing the app uses", !msgs.some((m) => /Refused|Content Security/i.test(m)), msgs.filter((m) => /Refused|Content Security/i.test(m)).join(" | "));
for (const hash of ["#/", "#/cards", "#/practice", "#/progress", "#/search", "#/glossary", "#/l/motion/notes", "#/l/motion/quiz", "#/l/motion/games", "#/profile"]) { await p.evaluate((h) => { location.hash = h; }, hash); await new Promise((r) => setTimeout(r, 500)); }
chk("no policy violations or errors on any student page", !msgs.some((m) => /^(error|PAGEERR)/.test(m)) , msgs.filter((m) => /^(error|PAGEERR)/.test(m)).join(" | "));
await p.evaluate(() => { localStorage.setItem("erth209:a11y", JSON.stringify({ easy: true })); }); await p.reload({ waitUntil: "networkidle0" }); await new Promise((r) => setTimeout(r, 600));
chk("the easy-read font works without loading anything remote", await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check("400 16px 'Atkinson Hyperlegible'") && getComputedStyle(document.body).fontFamily.includes("Atkinson"); }) && ext.length === 0);
await p.screenshot({ path: SHOTS + "/fonts_check.png" });
await b.close(); process.exit(bad ? 1 : 0);
