"""Keeps the three copies of the schools upgrade in step.

supabase/patch6.sql is the source. This script
  - copies it to supabase/RUN-ME-2.sql (the single file the owner pastes into the SQL Editor), and
  - makes the end of supabase/schema.sql (a fresh install) identical to it.

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
    patch = text(ROOT / "patch6.sql")
    schema = text(ROOT / "schema.sql")
    i = schema.find(MARK)
    if i < 0:
        print("schema.sql has no '%s' marker" % MARK)
        return 1
    want_schema = schema[:i] + patch
    ok = True
    if text(ROOT / "RUN-ME-2.sql") != patch:
        ok = False
        print("RUN-ME-2.sql is out of date")
        if not check:
            (ROOT / "RUN-ME-2.sql").write_bytes(patch.encode("utf8"))
    if schema != want_schema:
        ok = False
        print("schema.sql does not end with patch6.sql")
        if not check:
            (ROOT / "schema.sql").write_bytes(want_schema.encode("utf8"))
    if ok:
        print("sql copies are in step")
        return 0
    return 1 if check else 0


if __name__ == "__main__":
    sys.exit(main())
