"""One-time cleanup of the class glossaries (kept in the repo so the result can be checked and repeated).

A glossary entry is only a term, a piece of vocabulary or a name (rules in js/glossaryrules.js). Every flashcard in content/*.json is looked at:
  - a front that already is a term is left alone;
  - a front written as a question that is really asking for one term ("What is osmosis?") gets  "term": "Osmosis"  and keeps its answer;
  - anything else (real questions, long phrases) gets  "gloss": false : it stays a flashcard but is not listed in the glossary.
No flashcard is deleted. The report goes to docs/GLOSSARY-CLEANUP.md.

  python tools/glossary_cleanup.py            apply and write the report
  python tools/glossary_cleanup.py --check    only report whether the content is already clean (used by CI)
"""
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OPENERS = {"what", "why", "how", "when", "where", "which", "who", "whom", "whose", "name", "define", "explain", "describe", "list", "give",
           "state", "compare", "is", "are", "does", "do", "can", "should", "would", "will"}


def is_term(t):
    t = t.replace("**", "").strip()
    if not t or "?" in t:
        return False
    w = t.split()
    if re.sub("[^a-z]", "", w[0].lower()) in OPENERS:
        return False
    if len(w) > 4 or len(t) > 60:
        return False
    if re.search("[.!;:]$", t):
        return False
    if re.search("(process|processes|procedure|procedures|steps|stages of|explanation|overview|summary|introduction|comparison|difference|differences)$", t, re.I):
        return False
    return not re.search(r"(?:^|[ ])(?:vs[.]?|versus)(?:[ ]|$)", t, re.I)


# patterns that ask for exactly one term
BAD_END = re.compile(r"(?:^|[ ])(made of|do|does|for|called|known as|used for|in|of|on|at|by|with|from|to)$", re.I)
PATTERNS = [
    re.compile(r"^what (?:is|are) (?:a |an |the )?(.+?)[?]$", re.I),
    re.compile(r"^what does (?:the |a |an )?(.+?) (?:do|contain)[?]$", re.I),
    re.compile(r"^what do (.+?) do[?]$", re.I),
    re.compile(r"^define (?:the |a |an )?(.+?)[.]?$", re.I),
    re.compile(r"^describe the structure of (?:a |an |the )?(.+?)[.]?$", re.I),
]


def convert(front):
    for p in PATTERNS:
        m = p.match(front.strip())
        if not m:
            continue
        x = m.group(1).strip()
        if " and " in x.lower() or "," in x or BAD_END.search(x) or len(x.split()) > 4:
            continue
        x = x[0].upper() + x[1:] if x[0].islower() else x
        if is_term(x):
            return x
    return None


def read(p):
    return json.loads(p.read_bytes().decode("utf8"))


def write(p, d):
    s = json.dumps(d, indent=1, ensure_ascii=False).replace("\n", "\r\n")
    p.write_bytes(s.encode("utf8"))


def main():
    check = "--check" in sys.argv
    subjects = read(ROOT / "content" / "subjects.json")
    course_of = {lid: sj["id"] for sj in subjects for lid in sj["lectures"]}
    names = {sj["id"]: sj["name"] for sj in subjects}
    conv, rem, kept, dirty = [], [], {}, 0
    for lid, cid in course_of.items():
        p = ROOT / "content" / (lid + ".json")
        d = read(p)
        changed = False
        for i, c in enumerate(d.get("cards", [])):
            front = c["front"]
            if "gloss" in c or "term" in c:  # already handled
                if c.get("gloss") is False:
                    rem.append((cid, lid, front))
                elif "term" in c:
                    conv.append((cid, lid, front, c["term"]))
                else:
                    kept[cid] = kept.get(cid, 0) + 1
                continue
            if is_term(front):
                kept[cid] = kept.get(cid, 0) + 1
                continue
            dirty += 1
            t = convert(front)
            new = {}
            for k, v in c.items():
                new[k] = v
                if k == "front":
                    if t:
                        new["term"] = t
                    else:
                        new["gloss"] = False
            d["cards"][i] = new
            changed = True
            if t:
                conv.append((cid, lid, front, t))
            else:
                rem.append((cid, lid, front))
        if changed and not check:
            write(p, d)
    if check:
        print("glossary content is clean" if not dirty else f"{dirty} flashcards still need the glossary cleanup (run python tools/glossary_cleanup.py)")
        return 1 if dirty else 0
    # report
    out = ["# Glossary cleanup", "",
           "A glossary entry is only a **term, vocabulary or a name** (at most 4 words, not a question, no sentence). Rules: `js/glossaryrules.js`.",
           "Nothing was deleted: every item below is still a flashcard. \"Converted\" cards are listed in the glossary under the short term; "
           "\"Removed from the glossary\" cards are left out of the glossary only.", "",
           "| Class | Glossary terms now | Converted | Removed from glossary |", "|---|---|---|---|"]
    for cid in names:
        k = kept.get(cid, 0) + sum(1 for x in conv if x[0] == cid)
        out.append(f"| {names[cid]} | {k} | {sum(1 for x in conv if x[0] == cid)} | {sum(1 for x in rem if x[0] == cid)} |")
    out += ["", "## Converted to a term", ""]
    for cid in names:
        rows = [x for x in conv if x[0] == cid]
        if rows:
            out += [f"### {names[cid]}", ""] + [f"- {a} -> **{b}** ({lid})" for _, lid, a, b in rows] + [""]
    out += ["## Removed from the glossary (still flashcards)", ""]
    for cid in names:
        rows = [x for x in rem if x[0] == cid]
        if rows:
            out += [f"### {names[cid]} ({len(rows)})", ""] + [f"- {a} ({lid})" for _, lid, a in rows] + [""]
    (ROOT / "docs" / "GLOSSARY-CLEANUP.md").write_bytes(("\n".join(out)).encode("utf8"))
    print(f"converted {len(conv)}, removed from glossary {len(rem)}; report: docs/GLOSSARY-CLEANUP.md")
    for cid in names:
        print(names[cid], "glossary terms:", kept.get(cid, 0) + sum(1 for x in conv if x[0] == cid))
    return 0


if __name__ == "__main__":
    sys.exit(main())
