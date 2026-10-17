"""Builds content/manifest.json: a tiny index (ids and counts only) so the app can show classes,
lectures and progress without downloading every lecture file. Run after any content change.
   python tools/build_manifest.py          # write
   python tools/build_manifest.py --check  # exit 1 if the manifest is out of date (used by CI)"""
import json, sys, os
root = os.path.join(os.path.dirname(__file__), "..")
os.chdir(root)
subjects = json.load(open("content/subjects.json", encoding="utf8"))
out = {}
for sj in subjects:
    for lid in sj["lectures"]:
        d = json.load(open(f"content/{lid}.json", encoding="utf8"))
        out[lid] = {
            "id": d["id"], "title": d["title"], "chapter": d.get("chapter", ""), "icon": d.get("icon", ""), "subject": sj["id"],
            "sections": [s["id"] for s in d["sections"]], "cards": [c["id"] for c in d.get("cards", [])], "quiz": [q["id"] for q in d.get("quiz", [])],
            "games": d.get("games", []), "order": bool(d.get("order")), "sort": bool(d.get("sort")), "calc": bool(d.get("calc")),
        }
text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
if "--check" in sys.argv:
    cur = open("content/manifest.json", encoding="utf8").read() if os.path.exists("content/manifest.json") else ""
    if cur.strip() != text.strip():
        print("content/manifest.json is out of date. Run: python tools/build_manifest.py"); sys.exit(1)
    print("manifest ok:", len(out), "lectures"); sys.exit(0)
open("content/manifest.json", "w", encoding="utf8").write(text)
print("wrote content/manifest.json:", len(out), "lectures,", len(text) // 1024, "KB")
