// Runs every browser test (needs the site served on http://localhost:8765 and Chrome; see tools/browser/common.mjs).
//   python -m http.server 8765 &   then   node tools/browser/run.mjs
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const f of ["policy-and-fonts.mjs", "workspace-demo.mjs", "real-paths.mjs", "two-step.mjs", "authoring-demo.mjs", "edit-demo.mjs", "edit-real.mjs", "a11y.mjs", "a11y-states.mjs", "a11y-phone.mjs", "account-flows.mjs", "phone-shots.mjs"]) {
  let r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: "utf8", timeout: 900000 });
  if (r.status !== 0) { console.log(`retrying ${f} once (browser tests can be slow on a busy machine)`); r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: "utf8", timeout: 900000 }); }
  const out = (r.stdout || "") + (r.stderr || "");
  const lines = out.split("\n").filter(Boolean), bad = lines.filter((l) => /^FAIL|^ERRORS|^PAGEERR|Error/.test(l));
  console.log(`${r.status === 0 ? "ok  " : "FAIL"} ${f}  (${lines.filter((l) => l.startsWith("PASS")).length} checks passed${bad.length ? ", " + bad.length + " problem lines" : ""})`);
  if (r.status !== 0) { failed++; console.log(out.split("\n").filter((l) => !l.startsWith("PASS")).join("\n")); }
}
process.exit(failed ? 1 : 0);
