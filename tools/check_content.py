"""Content checks used by CI and by hand:  python tools/check_content.py
Fails (exit 1) on: invalid JSON, duplicate ids, bad quiz answers, missing images, stale manifest,
or source words (slide / lecture / textbook / professor ...) in text students can see."""
import json, os, re, subprocess, sys
root = os.path.join(os.path.dirname(__file__), "..")
os.chdir(root)
REF = re.compile(r"\b(slides?|lectures?|text ?books?|books?|professor|profs?|marshak|clickers?|outside source|chapter \d|section \d|practice (?:test|exam|questions?)|tophat|top hat)\b", re.I)
problems = []
def bad(where, msg): problems.append(f"{where}: {msg}")
def leak(where, t):
    if isinstance(t, str) and REF.search(t): bad(where, f"source word in student text: {t[:80]!r}")
def img_ok(where, img):
    if img and not os.path.exists(img["src"]): bad(where, "missing image " + img["src"])

subjects = json.load(open("content/subjects.json", encoding="utf8"))
for sj in subjects:
    for lid in sj["lectures"]:
        w = lid
        try: d = json.load(open(f"content/{lid}.json", encoding="utf8"))
        except Exception as e: bad(w, f"invalid JSON ({e})"); continue
        for k in ("id", "title", "sections", "cards", "quiz"):
            if k not in d: bad(w, "missing " + k)
        if d.get("id") != lid: bad(w, "id does not match file name")
        leak(w + " title", d.get("title")); leak(w + " intro", d.get("intro", ""))
        sids = [s["id"] for s in d["sections"]]
        if len(set(sids)) != len(sids): bad(w, "duplicate section ids")
        for s in d["sections"]:
            leak(f"{w}/{s['id']} title", s["title"])
            for b in s.get("bullets", []): leak(f"{w}/{s['id']} bullet", b)
            for b in s.get("boxes", []):
                if b["type"] != "trap": leak(f"{w}/{s['id']} box", b["text"])
            for st in s.get("steps", []):
                leak(f"{w}/{s['id']} step", st.get("title", ""))
                for b in st.get("bullets", []): leak(f"{w}/{s['id']} step", b)
                if st.get("img"): img_ok(f"{w}/{s['id']}", st["img"]); leak(f"{w}/{s['id']} alt", st["img"].get("alt", ""))
        cids = [c["id"] for c in d["cards"]]
        if len(set(cids)) != len(cids): bad(w, "duplicate card ids")
        for c in d["cards"]:
            for k in ("front", "back", "short"):
                if not c.get(k): bad(w, f"card {c['id']} missing {k}")
                leak(f"{w}/{c['id']}", c.get(k, ""))
        qids = [q["id"] for q in d["quiz"]]
        if len(set(qids)) != len(qids): bad(w, "duplicate quiz ids")
        for q in d["quiz"]:
            n = len(q["options"])
            if n not in (4, 5) or not (0 <= q["answer"] < n): bad(w, f"quiz {q['id']} has a bad answer index")
            if len(set(q["options"])) != n: bad(w, f"quiz {q['id']} has duplicate options")
            leak(f"{w}/{q['id']} q", q["q"]); leak(f"{w}/{q['id']} why", q["why"])
            for o in q["options"]: leak(f"{w}/{q['id']} option", o)
            img_ok(f"{w}/{q['id']}", q.get("img"))
    if sj.get("exams"):
        e = json.load(open(f"content/{sj['exams']}.json", encoding="utf8"))
        ids = []
        for t in e["tests"]:
            for q in t["questions"]:
                ids.append(q["id"]); n = len(q["options"])
                if not (0 <= q["answer"] < n): bad(sj["exams"], f"{q['id']} bad answer index")
                leak(f"exam {q['id']} q", q["q"]); leak(f"exam {q['id']} why", q["why"]); img_ok(sj["exams"], q.get("img"))
                for o in q["options"]: leak(f"exam {q['id']} option", o)
        if len(set(ids)) != len(ids): bad(sj["exams"], "duplicate exam question ids")
# the screens themselves must not talk about the source of the material either (admin-only lines are marked with "refs", "admin" or "canSeeRefs")
UI_REF = re.compile(r"\b(prof['’]s|profs?|professors?|text ?books?|marshak)\b", re.I)
for f in ("js/main.js", "js/games.js", "js/staff.js", "js/mfa.js"):
    for n, line in enumerate(open(f, encoding="utf8"), 1):
        code = line.split("//")[0] if "http" not in line else line
        if UI_REF.search(code) and not re.search(r"admin|refs|canSeeRefs|REF\b", line):
            bad(f"{f}:{n}", "source word in a screen text: " + line.strip()[:90])
r = subprocess.run([sys.executable, "tools/build_manifest.py", "--check"], capture_output=True, text=True)
if r.returncode: bad("manifest", r.stdout.strip() or r.stderr.strip())
if problems:
    print(f"{len(problems)} problem(s):"); [print(" -", p) for p in problems[:60]]; sys.exit(1)
print("content ok:", sum(len(s["lectures"]) for s in subjects), "lectures checked")
