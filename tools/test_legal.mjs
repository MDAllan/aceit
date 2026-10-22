// Tests for the Terms of Service and Privacy Policy (js/legal-text.js, js/legal.js). Run: node tools/test_legal.mjs
// Fails (exit 1) if a required topic is missing, if a document lacks its version or date, if the text contains an email address,
// phone number, web address or street address, if it contradicts the never-sold promise, or if the renderer breaks the rules.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as DATA from "../js/legal-text.js";

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error("FAIL:", msg); } };
const { TERMS, PRIVACY } = DATA;

/* ---------- helpers ---------- */
const plain = (t) => String(t).replace(/[*]/g, "").replace(/[ \t\r\n]+/g, " ").trim(); // text without emphasis marks
const strings = (d) => [["title", d.title], ...d.intro.map((t, i) => ["intro " + (i + 1), t]),
  ...d.sections.flatMap((s) => [[s.id + " title", s.title], ...s.paras.map((t, i) => [s.id + " para " + (i + 1), t]), ...(s.items || []).map((t, i) => [s.id + " item " + (i + 1), t])])];
const words = (d) => strings(d).map(([, t]) => plain(t)).join(" ").split(" ").filter(Boolean).length;
const sentences = (t) => plain(t).split(/(?<=[.!?:;])[ ]+/);
const sectionText = (d, rx) => d.sections.filter((s) => rx.test(s.title)).map((s) => plain([s.title, ...s.paras, ...(s.items || [])].join(" "))).join(" ").toLowerCase();
const docText = (d) => strings(d).map(([, t]) => plain(t)).join(" ").toLowerCase();

/* ---------- 1. version and date ---------- */
const isDate = (s) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
for (const [name, doc, ver, upd] of [["TERMS", TERMS, DATA.TERMS_VERSION, DATA.TERMS_UPDATED], ["PRIVACY", PRIVACY, DATA.PRIVACY_VERSION, DATA.PRIVACY_UPDATED]]) {
  ok(typeof ver === "string" && /^[0-9]+[.][0-9]+$/.test(ver), `${name}_VERSION must be a string like "1.0" (got ${JSON.stringify(ver)})`);
  ok(typeof upd === "string" && isDate(upd), `${name}_UPDATED must be a real date as YYYY-MM-DD (got ${JSON.stringify(upd)})`);
  ok(doc.version === ver, `${name}.version must equal the exported version`);
  ok(doc.updated === upd, `${name}.updated must equal the exported date`);
  ok(typeof doc.title === "string" && doc.title.length > 3, `${name}.title missing`);
}

/* ---------- 2. structure ---------- */
for (const [name, doc] of [["TERMS", TERMS], ["PRIVACY", PRIVACY]]) {
  ok(Array.isArray(doc.intro) && doc.intro.length >= 2, `${name}: intro must be an array of paragraphs`);
  ok(Array.isArray(doc.sections) && doc.sections.length >= 10, `${name}: too few sections`);
  const ids = new Set();
  for (const s of doc.sections) {
    ok(/^[a-z][a-z0-9-]*$/.test(s.id || ""), `${name}: bad section id ${JSON.stringify(s.id)}`);
    ok(!ids.has(s.id), `${name}: duplicate section id ${s.id}`); ids.add(s.id);
    ok(typeof s.title === "string" && s.title.length > 2, `${name}/${s.id}: missing title`);
    ok(Array.isArray(s.paras) && s.paras.length >= 1, `${name}/${s.id}: needs at least one paragraph`);
    ok(s.items === undefined || (Array.isArray(s.items) && s.items.length >= 1), `${name}/${s.id}: items must be a non-empty array when present`);
    const extra = Object.keys(s).filter((k) => !["id", "title", "paras", "items"].includes(k));
    ok(!extra.length, `${name}/${s.id}: unexpected keys ${extra.join(", ")}`);
  }
  for (const [where, t] of strings(doc)) {
    ok(typeof t === "string" && t.length > 0, `${name}: ${where} is empty or not a string`);
    if (typeof t !== "string") continue;
    ok(t === t.trim() && !/  /.test(t), `${name}: ${where} has stray spaces`);
  }
}

/* ---------- 3. text hygiene (ASCII only, no markup, balanced emphasis) ---------- */
for (const [name, doc] of [["TERMS", TERMS], ["PRIVACY", PRIVACY]]) {
  for (const [where, t] of strings(doc)) {
    const bad = [...String(t)].find((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126);
    ok(bad === undefined, `${name}: ${where} contains a non-ASCII or control character (code ${bad === undefined ? "" : bad.charCodeAt(0)}); no emoji or smart quotes allowed`);
    ok(!/[\\<>`]/.test(t), `${name}: ${where} contains a backslash, angle bracket or backtick`);
    ok(!/[*]/.test(String(t).replace(/[*][*][^*]+[*][*]/g, "").replace(/[*][^*]+[*]/g, "")), `${name}: ${where} has unbalanced emphasis marks`);
    ok(!/todo|lorem|placeholder|xxx/i.test(t), `${name}: ${where} looks unfinished`);
  }
}

/* ---------- 4. no contact details of any kind ---------- */
const NOT_ALLOWED = [
  [/@/, "an at sign (email address)"],
  [/[A-Za-z0-9._%+-]+ ?(?:\[at\]|\(at\)) ?[A-Za-z0-9.-]+/i, "an obfuscated email address"],
  [/https?:/i, "a web address"],
  [/\bwww[.]/i, "a web address"],
  [/\b[a-z0-9-]+[.](?:com|ca|org|net|io|app|dev|edu|gov|co|me|ai|info|biz|us|uk)\b/i, "a domain name"],
  [/(?:[+]?[0-9]{1,2}[ .-]?)?[(]?[0-9]{3}[)]?[ .-][0-9]{3}[ .-][0-9]{4}\b/, "a phone number"],
  [/\b[0-9]{10,}\b/, "a long digit string (phone number)"],
  [/\b[A-Z][0-9][A-Z] ?[0-9][A-Z][0-9]\b/, "a postal code"],
  [/\b[0-9]{1,5} +(?:[A-Z][a-z]+ +){0,2}(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|way|crescent|cres)\b/i, "a street address"],
  [/\b(?:call us|text us|dial|telephone number is|phone number is|email us at|write to us at)\b/i, "an invitation to use another contact channel"]
];
for (const [name, doc] of [["TERMS", TERMS], ["PRIVACY", PRIVACY]]) {
  for (const [where, t] of strings(doc)) for (const [rx, what] of NOT_ALLOWED) ok(!rx.test(t), `${name}: ${where} contains ${what}`);
}

/* ---------- 5. the never-sold promise ---------- */
const TRADE = /\b(?:sell|sells|selling|sold|rent|rents|renting|rented|trade|trades|trading|traded|monetize|monetise|monetizes|monetises)\b/i;
const NEGATION = /\b(?:never|not|no|nor|cannot|without)\b/i;
for (const [name, doc] of [["TERMS", TERMS], ["PRIVACY", PRIVACY]]) {
  for (const [where, t] of strings(doc)) {
    ok(!/sell your/i.test(t), `${name}: ${where} contains the words "sell your"`);
    for (const s of sentences(t)) ok(!TRADE.test(s) || NEGATION.test(s), `${name}: ${where} mentions selling or renting without a negation: "${s}"`);
  }
  const txt = docText(doc);
  ok(/never sold/.test(txt), `${name}: must say that personal information is never sold`);
  ok(strings(doc).some(([, t]) => sentences(t).some((s) => /advertis/i.test(s) && /\b(?:not|no|never)\b/i.test(s) && /\b(?:use|used|share|contains?)\b/i.test(s))), `${name}: must say that data is not used for advertising`);
  ok(!/\b(?:personalized|targeted|behavioural|behavioral) (?:ads|advertising|advertisements)\b/i.test(txt) || /\b(?:no|not|never)\b[^.]*\b(?:personalized|targeted|behavioural|behavioral) (?:ads|advertising)/i.test(txt), `${name}: do not promise advertising`);
}

/* ---------- 6. required topics ---------- */
// Each topic: a heading pattern (must match at least one section title) and key phrases (must all appear in the matching sections).
const T = (name, head, phrases) => ({ name, head, phrases });
const REQUIRED_TERMS = [
  T("acceptance and how agreement is recorded", /acceptance/i, ["tick the box", "date and time", "version of the terms", "next time they log in", "valid electronic signature"]),
  T("purpose of the app", /purpose/i, ["academic development", "creator", "classmates and other students"]),
  T("eligibility and age", /eligibility/i, ["at least 13", "age of majority", "parent or legal guardian", "bars you"]),
  T("accounts and roles", /your account and roles/i, ["accurate and current information", "one person only", "class code", "student", "instructor", "school manager", "administrator"]),
  T("acceptable use", /acceptable use/i, ["harass", "impersonate", "academic integrity"]),
  T("security", /security/i, ["responsible for keeping your password", "all activity that happens under your account", "scrape", "automated", "reverse engineer", "decompile", "bots", "cheat", "tamper with scores, streaks, badges, xp", "challenges", "60-second sprint", "bypass", "overload", "malware", "post class codes", "without notice", "no system is completely secure", "not liable for unauthorized access", "report it through customer service"]),
  T("use of data", /use of data/i, ["improve the course materials", "aggregated", "anonymized", "never sold", "advertising", "privacy policy"]),
  T("user content and licence", /your content/i, ["keep ownership", "worldwide, non-exclusive, royalty-free licence", "use, store, reproduce, adapt and display", "notes", "flashcards", "feedback", "review", "rating", "support questions", "you promise that you own", "profile photos must be appropriate"]),
  T("intellectual property", /intellectual property/i, ["badge artwork", "non-commercial", "non-transferable", "copyright", "publishers", "instructors"]),
  T("educational disclaimer", /educational disclaimer/i, ["study aid", "does not guarantee", "errors, omissions", "syllabus", "delivered", "official materials"]),
  T("notifications, sharing and challenges", /notifications, sharing and challenges/i, ["share links", "first name", "account of their own", "turn notifications on or off", "profile"]),
  T("third-party services", /third-party/i, ["cloud database", "hosting", "share sheet", "not responsible"]),
  T("as is and as available", /warrant/i, ["as is", "as available", "express or implied", "merchantability", "fitness for a particular purpose", "non-infringement", "without interruption", "error-free"]),
  T("limitation of liability", /limitation of liability/i, ["maximum extent permitted by law", "indirect, incidental, special, consequential", "punitive", "loss of data", "loss of grades", "loss of opportunities", "100 canadian dollars", "do not allow"]),
  T("indemnification", /indemnif/i, ["indemnify", "hold harmless"]),
  T("service changes, suspension and shutdown", /changes to the service/i, ["suspend", "at any time", "notice", "download my data"]),
  T("account deletion", /account deletion/i, ["22 days", "grace period", "same email address", "cancelled", "restored", "permanent", "cannot be undone", "backups", "privacy policy", "customer service"]),
  T("termination by the owner", /termination/i, ["without notice"]),
  T("data retention", /retention/i, ["privacy policy"]),
  T("changes to the terms", /changes to these terms/i, ["version number", "notice in the app", "next login", "keep using the service"]),
  T("governing law and disputes", /governing law/i, ["province of alberta", "federal laws of canada", "courts of the province of alberta", "informally", "customer service"]),
  T("general provisions", /general provisions/i, ["severability", "entire agreement", "no waiver", "assignment", "survival", "headings", "language"]),
  T("how to contact", /contact/i, ["customer service", "ask a question", "profile"])
];
const REQUIRED_PRIVACY = [
  T("who we are and scope", /who we are/i, ["individual", "not a school", "alberta"]),
  T("what data is collected", /information we collect/i, ["email address", "first name or display name", "hashed form", "never visible to us", "progress", "answers", "scores", "streaks", "xp", "badges", "flashcard review history", "personal bests", "60-second sprint", "shares and challenges", "classes you join", "school", "role", "exam dates", "profile photo or avatar", "reviews, ratings and feedback", "customer service questions", "terms acceptance record", "date and time", "device data kept in your browser", "technical logs and error reports", "notification preferences"]),
  T("why data is used", /how we use/i, ["create and run your account", "sync your progress", "instructors and school managers", "improve the course materials", "protect the service", "answer your customer service", "comply with the law"]),
  T("consent and legal framework", /consent and legal framework/i, ["pipeda", "pipa", "consent", "withdraw your consent"]),
  T("privacy principles", /principles/i, ["accountability", "identifying purposes", "limiting collection", "accuracy", "safeguards", "openness", "individual access", "challenging compliance"]),
  T("storage and protection", /store and protect|limits of security/i, ["cloud database", "encrypted in transit", "database level", "hashed form", "two-step login", "staff", "need it", "no system is perfectly secure", "real risk of significant harm", "notify"]),
  T("who can see it", /who can see/i, ["name, email address and progress", "instructors and school managers", "administrators", "service providers", "other students cannot", "never sold", "advertising"]),
  T("aggregated or anonymized use", /aggregated/i, ["aggregated", "anonymized", "improve the course materials"]),
  T("retention and deletion", /retention and deletion/i, ["22 days", "grace period", "permanently deleted", "35 days", "24 months", "backups", "customer service questions", "acceptance records", "cannot be undone"]),
  T("your rights", /your rights/i, ["access", "correction", "deletion", "withdrawing consent", "download my data", "challenging compliance", "office of the privacy commissioner of canada", "office of the information and privacy commissioner of alberta"]),
  T("children and minors", /children/i, ["at least 13", "parent or guardian", "age of majority"]),
  T("cookies and local storage", /cookies/i, ["advertising cookies", "third-party analytics", "local storage", "service worker", "offline", "theme", "session token", "clear"]),
  T("notifications", /^notifications$/i, ["opt in", "profile", "marketing", "turn notifications on or off"]),
  T("sharing links and challenges", /sharing links/i, ["first name", "score", "the game", "needs an account"]),
  T("international transfers", /international/i, ["outside alberta", "outside canada", "encryption"]),
  T("changes to the policy", /changes to this privacy policy/i, ["version number", "notice in the app", "next login"]),
  T("how to contact", /contact/i, ["customer service", "ask a question", "profile"])
];
for (const [name, doc, list] of [["TERMS", TERMS, REQUIRED_TERMS], ["PRIVACY", PRIVACY, REQUIRED_PRIVACY]]) {
  for (const t of list) {
    const hits = doc.sections.filter((s) => t.head.test(s.title));
    ok(hits.length > 0, `${name}: missing a section for "${t.name}" (no heading matches ${t.head})`);
    if (!hits.length) continue;
    const body = sectionText(doc, t.head);
    for (const p of t.phrases) ok(body.includes(p.toLowerCase()), `${name}: section "${t.name}" is missing the phrase "${p}"`);
  }
}

/* ---------- 7. facts both documents must state, and that must agree ---------- */
for (const [name, doc, other] of [["TERMS", TERMS, "privacy policy"], ["PRIVACY", PRIVACY, "terms of service"]]) {
  const txt = docText(doc);
  ok(txt.includes(other), `${name}: must refer to the ${other}`);
  ok(txt.includes("customer service") && txt.includes("ask a question"), `${name}: must name the in-app Customer Service as the contact route`);
  ok(txt.includes("individual student") && txt.includes("alberta"), `${name}: must say that the Owner is an individual student in Alberta`);
  ok(txt.includes("the owner"), `${name}: must define the Owner`);
  ok(/22 days/.test(txt), `${name}: must state the 22-day deletion grace period`);
  ok(txt.includes("at least 13"), `${name}: must state the minimum age`);
  // any number of days mentioned next to deletion, restoring or cancelling (backups excepted) must be the 22-day grace period
  for (const [where, t] of strings(doc)) for (const s of sentences(t)) {
    if (!/grace|delet|restor|cancel/i.test(s) || /backup/i.test(s)) continue;
    for (const m of s.matchAll(/([0-9]+) days/g)) ok(m[1] === "22", `${name}: ${where} gives ${m[1]} days next to deletion; the grace period is 22 days: "${s}"`);
  }
}

/* ---------- 8. size ---------- */
const wTerms = words(TERMS), wPrivacy = words(PRIVACY);
console.log(`Terms of Service : version ${TERMS.version}, updated ${TERMS.updated}, ${TERMS.sections.length} sections, ${wTerms} words`);
console.log(`Privacy Policy   : version ${PRIVACY.version}, updated ${PRIVACY.updated}, ${PRIVACY.sections.length} sections, ${wPrivacy} words`);
ok(wTerms >= 3500, `Terms of Service is much shorter than intended (${wTerms} words; target 4,500-6,500)`);
ok(wPrivacy >= 2500, `Privacy Policy is much shorter than intended (${wPrivacy} words; target 3,000-4,500)`);
if (wTerms < 4500 || wTerms > 6500) console.log(`note: Terms of Service is outside the 4,500-6,500 word target (${wTerms})`);
if (wPrivacy < 3000 || wPrivacy > 4500) console.log(`note: Privacy Policy is outside the 3,000-4,500 word target (${wPrivacy})`);

/* ---------- 9. the renderer (js/legal.js) ---------- */
const root = new URL("../", import.meta.url);
const legalSrc = readFileSync(new URL("js/legal.js", root), "utf8");
const legalCode = legalSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""); // code without comments
ok(!/href\s*[:=]/.test(legalCode), "legal.js must not use href (the site uses hash routing; the table of contents uses buttons)");
ok(/scrollIntoView/.test(legalSrc), "legal.js must scroll to sections with scrollIntoView");
ok(/aria-label["']?\s*:\s*["']Contents["']/.test(legalSrc), 'legal.js must label the table of contents nav with aria-label "Contents"');
ok(/from\s+["']\.\/ui\.js["']/.test(legalSrc) && /from\s+["']\.\/legal-text\.js["']/.test(legalSrc), "legal.js must import ui.js and re-export legal-text.js");
ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(legalSrc), "legal.js must not hard-code colours (use CSS variables)");
ok(/0x2063/.test(legalSrc), "legal.js must keep the as-written mark so ui.js clean() does not cut legal text");

const tmp = mkdtempSync(join(tmpdir(), "aceit-legal-"));
try {
  // Rebuild ui.js's real h/md/clean in Node (non-admin view) so the renderer is tested against the app's own functions.
  const uiSrc = readFileSync(new URL("js/ui.js", root), "utf8");
  const a = uiSrc.indexOf("export function h("), b = uiSrc.indexOf("/* ---------- icons");
  ok(a >= 0 && b > a, "could not find h/clean/md in js/ui.js; update tools/test_legal.mjs");
  const slice = uiSrc.slice(a, b).replace(/^export /gm, "");
  writeFileSync(join(tmp, "ui-stub.mjs"), "const canSeeRefs = () => false;\n" + slice + "\nexport { h, md, clean };\nexport const reducedMotion = () => false;\n");
  writeFileSync(join(tmp, "legal-under-test.mjs"), legalSrc.replace(/from\s+["']\.\/ui\.js["']/, 'from "./ui-stub.mjs"').replace(/from\s+["']\.\/legal-text\.js["']/, 'from "' + pathToFileURL(new URL("js/legal-text.js", root).pathname.replace(/^[/]([A-Za-z]:)/, "$1")).href + '"'));

  // minimal DOM
  class N { }
  class Text extends N { constructor(t) { super(); this.nodeType = 3; this.data = String(t); } }
  class Frag extends N { constructor() { super(); this.nodeType = 11; this.childNodes = []; } append(...k) { for (const c of k) this.childNodes.push(c); } }
  class El extends N {
    constructor(tag) { super(); this.nodeType = 1; this.tag = tag.toLowerCase(); this.attrs = {}; this.childNodes = []; this.id = ""; this.cls = new Set(); this.scrolled = 0; this.focused = 0; const me = this; this.classList = { add: (c) => me.cls.add(c) }; }
    append(...k) { for (const c of k) { if (c instanceof Frag) this.childNodes.push(...c.childNodes); else this.childNodes.push(c); } }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); }
    scrollIntoView() { this.scrolled++; }
    focus() { this.focused++; }
  }
  globalThis.Node = N;
  globalThis.document = { createElement: (t) => new El(t), createTextNode: (t) => new Text(t), createDocumentFragment: () => new Frag(), documentElement: { dataset: {} }, getElementById: () => null };
  const text = (n) => (n instanceof Text ? n.data : (n.childNodes || []).map(text).join(""));
  const walk = (n, f) => { f(n); if (n.childNodes) n.childNodes.forEach((c) => walk(c, f)); };
  const all = (n, f) => { const r = []; walk(n, (x) => { if (x.nodeType === 1 && f(x)) r.push(x); }); return r; };

  const L = await import(pathToFileURL(join(tmp, "legal-under-test.mjs")).href);
  for (const k of ["TERMS_VERSION", "TERMS_UPDATED", "PRIVACY_VERSION", "PRIVACY_UPDATED", "TERMS", "PRIVACY", "renderLegal", "LEGAL_LINKS"]) ok(k in L, `legal.js must export ${k}`);
  ok(L.TERMS === TERMS && L.PRIVACY === PRIVACY && L.TERMS_VERSION === DATA.TERMS_VERSION && L.PRIVACY_UPDATED === DATA.PRIVACY_UPDATED, "legal.js must re-export the data from legal-text.js unchanged");
  ok(L.LEGAL_LINKS && L.LEGAL_LINKS.terms === "#/terms" && L.LEGAL_LINKS.privacy === "#/privacy", "LEGAL_LINKS must be { terms: '#/terms', privacy: '#/privacy' }");

  for (const [name, doc] of [["TERMS", TERMS], ["PRIVACY", PRIVACY]]) {
    const el = L.renderLegal(doc);
    document.getElementById = (id) => all(el, (x) => x.id === id)[0] || null;
    ok(el && el.nodeType === 1, `${name}: renderLegal must return an element`);
    const h1 = all(el, (x) => x.tag === "h1");
    ok(h1.length === 1 && text(h1[0]) === doc.title, `${name}: exactly one h1 with the title`);
    ok(text(el).includes(`Version ${doc.version}, last updated `) && /last updated [A-Z][a-z]+ [0-9]{1,2}, [0-9]{4}/.test(text(el)), `${name}: must show "Version X, last updated DATE"`);
    const navs = all(el, (x) => x.tag === "nav");
    ok(navs.length === 1 && navs[0].attrs["aria-label"] === "Contents", `${name}: one nav labelled Contents`);
    const btns = navs.length ? all(navs[0], (x) => x.tag === "button") : [];
    ok(btns.length === doc.sections.length, `${name}: one contents button per section (${btns.length} of ${doc.sections.length})`);
    ok(btns.every((x) => x.attrs.type === "button"), `${name}: contents buttons must have type=button`);
    ok(all(el, (x) => "href" in x.attrs).length === 0, `${name}: no href attributes anywhere (hash routing)`);
    btns.forEach((bt, i) => { const target = document.getElementById("legal-" + doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + doc.sections[i].id); ok(!!target, `${name}: contents button ${i + 1} has no target`); if (target) { bt.onclick(); ok(target.scrolled === 1, `${name}: contents button ${i + 1} must scroll to its section`); } });
    const h2 = all(el, (x) => x.tag === "h2");
    ok(h2.length === doc.sections.length, `${name}: one h2 per section (${h2.length})`);
    h2.forEach((x, i) => ok(text(x) === `${i + 1}. ${doc.sections[i].title}`, `${name}: heading ${i + 1} must read "${i + 1}. ${doc.sections[i].title}"`));
    const levels = []; walk(el, (x) => { if (x.nodeType === 1 && /^h[1-6]$/.test(x.tag)) levels.push(+x.tag[1]); });
    ok(levels[0] === 1 && levels.every((v, i) => i === 0 || v - levels[i - 1] <= 1), `${name}: headings must be in order (got ${levels.slice(0, 6).join(",")}...)`);
    const secs = all(el, (x) => x.tag === "section");
    ok(secs.length === doc.sections.length, `${name}: one section element per section`);
    secs.forEach((sec, i) => {
      const s = doc.sections[i], ps = all(sec, (x) => x.tag === "p"), lis = all(sec, (x) => x.tag === "li");
      ok(ps.length === s.paras.length, `${name}/${s.id}: paragraph count`);
      ok(lis.length === (s.items || []).length, `${name}/${s.id}: item count`);
      ps.forEach((p, j) => ok(text(p) === plain(s.paras[j]).replace(/[ ]+/g, " ") || text(p) === s.paras[j].replace(/[*]/g, ""), `${name}/${s.id}: paragraph ${j + 1} was altered by the renderer (student filter?)`));
      lis.forEach((li, j) => ok(text(li) === s.items[j].replace(/[*]/g, ""), `${name}/${s.id}: item ${j + 1} was altered by the renderer`));
    });
    const intro = all(el, (x) => x.cls.has("legal-intro"))[0];
    ok(intro && all(intro, (x) => x.tag === "p").length === doc.intro.length, `${name}: all intro paragraphs rendered`);
    ok(all(el, (x) => x.cls.has("term")).length > 0 && all(el, (x) => x.tag === "em").length > 0, `${name}: bold and italic markup must render`);
    const styles = all(el, (x) => "style" in x.attrs).map((x) => x.attrs.style);
    ok(styles.every((s) => !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(s)), `${name}: no inline colours in styles`);
    ok(!/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(text(el)), `${name}: no emoji in the rendered page`);
  }
} catch (e) {
  fails++; console.error("FAIL: renderer test crashed:", e && e.stack || e);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (fails) { console.error(fails + " legal test(s) failed"); process.exit(1); }
console.log("all legal tests passed");
