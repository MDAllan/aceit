// Turn text pasted from a document or spreadsheet into questions or flashcards. No browser code here: the tests run it too.

const trim = (s) => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
const OPTION = /^\(?([A-Ea-e])[).:]\s+(.*)$/;
const META = /^(why|explanation|because|answer|ans|correct)\s*[:=-]\s*(.*)$/i;
const MARKS = /(\s*\*+\s*|\s*\(correct\)\s*|\s*✓\s*|\s*✔\s*)$/i;

// Blocks are separated by a blank line. Each block:
//   1. The question (can run over several lines)
//   a) first option
//   b) second option *            <- a star after the correct option, or a line "Answer: b"
//   Why: the explanation (optional)
export function parseQuestions(raw) {
  const items = [], errors = [];
  const blocks = String(raw || "").replace(/\r/g, "").split(/\n\s*\n/).map(trim).filter(Boolean);
  blocks.forEach((block, bi) => {
    const no = bi + 1, fail = (message) => errors.push({ block: no, message: `Question ${no}: ${message}` });
    const lines = block.split("\n").map(trim).filter(Boolean);
    const q = [], options = [], why = [];
    let correct = [], letter = null, letterBad = false, mode = "q";
    for (const line of lines) {
      const meta = META.exec(line), opt = OPTION.exec(line);
      if (opt && mode !== "why" && (mode !== "q" || q.length)) {
        mode = "opt";
        let t = opt[2], star = false;
        if (MARKS.test(t)) { star = true; t = t.replace(MARKS, ""); }
        if (/^\*+\s*/.test(t)) { star = true; t = t.replace(/^\*+\s*/, ""); }
        options.push(trim(t)); if (star) correct.push(options.length - 1);
        continue;
      }
      if (meta && mode !== "q") {
        const k = meta[1].toLowerCase();
        if (k === "answer" || k === "ans" || k === "correct") { const m = /^\(?([A-Ea-e])\b/.exec(meta[2]); if (m) letter = m[1].toLowerCase().charCodeAt(0) - 97; else { letterBad = true; fail("write the answer as a letter, for example Answer: b."); } }
        else { mode = "why"; why.push(meta[2]); }
        continue;
      }
      if (mode === "q") q.push(line.replace(q.length ? /^$/ : /^\d+[).:]\s*/, ""));
      else if (mode === "opt") options[options.length - 1] += " " + line;
      else why.push(line);
    }
    if (letterBad) return;
    if (letter !== null) correct = [letter];
    const text = q.join("\n");
    if (!text) return fail("the question text is missing.");
    if (options.length < 2) return fail("add at least two options, each starting with a) b) c)...");
    if (options.length > 5) return fail("use at most five options.");
    if (correct.length === 0) return fail("mark the correct option with a star (*) after it, or add a line like Answer: b.");
    if (correct.length > 1) return fail("more than one option is marked correct.");
    if (correct[0] >= options.length) return fail("the answer letter does not match an option.");
    const item = { q: text, options, answer: correct[0] };
    if (why.length) item.why = why.join(" ");
    items.push(item);
  });
  return { items, errors };
}

// One card per line. The front and the back are separated by a tab (copy two columns from a spreadsheet) or by a | character.
export function parseCards(raw) {
  const items = [], errors = [];
  String(raw || "").replace(/\r/g, "").split("\n").forEach((line, i) => {
    if (!trim(line)) return;
    const tab = line.indexOf("\t"), bar = line.indexOf("|"), at = tab >= 0 ? tab : bar;
    if (at < 0) { errors.push({ line: i + 1, message: `Line ${i + 1}: put a tab or a | between the front and the back.` }); return; }
    const front = trim(line.slice(0, at)), back = trim(line.slice(at + 1).replace(/^[\t|]+/, ""));
    if (!front || !back) { errors.push({ line: i + 1, message: `Line ${i + 1}: both the front and the back are needed.` }); return; }
    items.push({ front, back });
  });
  return { items, errors };
}
