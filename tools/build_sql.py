"""Keeps the copies of the database upgrades in step.

supabase/patch6.sql (schools), supabase/patch7.sql (instructor-authored content) and supabase/patch8.sql (terms, account deletion,
customer questions, admin instructor and content tools) are the sources. This script
  - copies patch6.sql to supabase/RUN-ME-2.sql, patch7.sql to supabase/RUN-ME-3.sql and patch8.sql to supabase/RUN-ME-4.sql (the single files the owner pastes into the SQL Editor), and
  - makes the end of supabase/schema.sql (a fresh install) patch6.sql, then patch7.sql, then patch8.sql.

  python tools/build_sql.py          rewrite the copies
  python tools/build_sql.py --check  only report whether they are in step (used by CI)
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "supabase"
MARK = "-- Patch 6:"


def text(p):
    return p.read_bytes().decode("utf8").replace("\r\n", "\n")


def main():
    check = "--check" in sys.argv
    p6, p7, p8 = text(ROOT / "patch6.sql"), text(ROOT / "patch7.sql"), text(ROOT / "patch8.sql")
    schema = text(ROOT / "schema.sql")
    i = schema.find(MARK)
    if i < 0:
        print("schema.sql has no '%s' marker" % MARK)
        return 1
    # everything before the patch 6 marker is the original schema and patches 1 to 5 and is left alone; the rest is rebuilt from the three sources
    want_schema = schema[:i] + p6.rstrip("\n") + "\n\n" + p7.rstrip("\n") + "\n\n" + p8
    ok = True
    for name, want in (("RUN-ME-2.sql", p6), ("RUN-ME-3.sql", p7), ("RUN-ME-4.sql", p8)):
        f = ROOT / name
        if not f.exists() or text(f) != want:
            ok = False
            print(name + " is out of date")
            if not check:
                f.write_bytes(want.encode("utf8"))
    if schema != want_schema:
        ok = False
        print("schema.sql does not end with patch6.sql, patch7.sql and patch8.sql")
        if not check:
            (ROOT / "schema.sql").write_bytes(want_schema.encode("utf8"))
    if ok:
        print("sql copies are in step")
        return 0
    return 1 if check else 0


if __name__ == "__main__":
    sys.exit(main())
