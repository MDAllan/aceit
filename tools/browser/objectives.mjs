import { launch } from "./common.mjs";
const b = await launch();
const p = await b.newPage();
const errors = [];
p.on("pageerror", e => errors.push(e.message));
let failed = 0;
const chk = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  " + detail : ""));
};
const open = async (id) => {
  await p.goto(`http://localhost:8765/?demo#/l/${id}/notes`, { waitUntil: "networkidle0" });
  await p.waitForSelector(".acc.objectives");
};
try {
  await open("fossils");
  const selector = ".learning-objectives input[type=checkbox]";
  const count = await p.$$eval(selector, inputs => inputs.length);
  chk("Fossils lesson shows all objectives", count === 14, `count=${count}`);
  const before = await p.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("erth209:progress:v1")) || { days: {}, stats: {} };
    return JSON.stringify({ days: data.days, stats: data.stats });
  });
  await p.$eval(".acc.objectives > button", button => button.click());
  await p.$eval(selector, input => input.click());
  const saved = await p.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("erth209:progress:v1"));
    return {
      checked: data.objectives?.fossils?.["goal-01"],
      days: data.days,
      stats: data.stats,
      label: document.querySelector(".acc.objectives > button").textContent
    };
  });
  chk("checking an objective saves its state without affecting completion", saved.checked === true && JSON.stringify({ days: saved.days, stats: saved.stats }) === before);
  chk("objective progress count updates", /1\/14 checked/.test(saved.label), saved.label);
  await p.reload({ waitUntil: "networkidle0" });
  await p.waitForSelector(".acc.objectives");
  chk("checked state survives reload", await p.$eval(selector, input => input.checked));
  await p.$eval(selector, input => input.click());
  await p.reload({ waitUntil: "networkidle0" });
  await p.waitForSelector(".acc.objectives");
  chk("unchecked state also survives reload", !(await p.$eval(selector, input => input.checked)));
  for (const [id, expected] of [["telescopes", 5], ["skeletal", 5]]) {
    await open(id);
    const n = await p.$$eval(selector, inputs => inputs.length);
    chk(`${id} lesson shows its checklist`, n === expected, `count=${n}`);
  }
  chk("no browser errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  failed++;
  console.error("ERROR", e.stack || e.message);
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
