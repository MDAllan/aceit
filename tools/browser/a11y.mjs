// Automated accessibility scan (axe-core, WCAG 2.0/2.1/2.2 A and AA rules) of the main student and staff screens, light and dark.
// Fails on serious or critical problems. Needs: npm i --no-save puppeteer-core axe-core
import { launch, SHOTS } from "./common.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const b = await launch();
let bad = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGES = [
  ["student home", "/?demo#/"], ["a class", "/?demo#/s/astr207"], ["notes", "/?demo#/l/motion/notes"], ["cards", "/?demo#/l/motion/cards"], ["quiz", "/?demo#/l/motion/quiz"], ["games", "/?demo#/l/motion/games"],
  ["progress", "/?demo#/progress"], ["search", "/?demo#/search"], ["profile", "/?demo#/profile"],
  ["admin: schools", "/?demo&role=admin#/work"], ["admin: school", "/?demo&role=admin#/work/school/sch-a"], ["admin: class", "/?demo&role=admin#/work/class/k-a1"], ["admin: settings", "/?demo&role=admin#/work/settings"], ["admin: people", "/?demo&role=admin#/work/school/sch-a/people"],
  ["manager: school", "/?demo&role=manager#/work"], ["instructor: classes", "/?demo&role=instructor#/work"],
];
for (const scheme of ["light", "dark"]) {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
  for (const [name, url] of PAGES) {
    await p.goto("http://localhost:8765" + url, { waitUntil: "networkidle0" }); await wait(900);
    await p.evaluate(axeSource); // evaluated directly, so the page's content security policy does not apply to it
    const res = await p.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 3).join(" ").slice(0, 160)) }))));
    const serious = res.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (serious.length) bad++;
    console.log((serious.length ? "FAIL " : "PASS ") + `${name} (${scheme})` + (res.length ? `  ${res.length} issue types: ` + res.map((v) => `${v.id}[${v.impact}] x${v.nodes}`).join(", ") : ""));
    for (const v of serious) console.log("   " + v.id + ": " + v.help + "\n     " + v.sample.join("\n     "));
    if (serious.length) await p.screenshot({ path: SHOTS + `/a11y_${scheme}_${name.replace(/\W+/g, "_")}.png` });
  }
  await p.close();
}
await b.close(); process.exit(bad ? 1 : 0);
