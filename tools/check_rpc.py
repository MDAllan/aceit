"""Checks that every database function the app calls exists, with the argument names the app sends.

The app calls functions like  sb.rpc("create_class", { sid, cid, nm })  and the database must have
create_class(sid uuid, cid text, nm text, ...). A misspelt argument only fails when someone clicks the button,
so this check reads both sides and compares them. Lines marked "legacy" (the fallback for a database that has not
been upgraded) are skipped, and so is the older admin screen (js/admin.js).

  python tools/check_rpc.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def strip_sql_comments(t):
    t = re.sub(r"/\*.*?\*/", "", t, flags=re.S)
    return re.sub(r"--[^\n]*", "", t)


def split_top(s, sep=","):
    out, depth, cur, q = [], 0, "", None
    for ch in s:
        if q:
            cur += ch
            if ch == q:
                q = None
            continue
        if ch in "'\"":
            q = ch
            cur += ch
        elif ch in "([{":
            depth += 1
            cur += ch
        elif ch in ")]}":
            depth -= 1
            cur += ch
        elif ch == sep and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


def sql_functions():
    """name -> list of (argument names, names that have a default). The last definition of a name wins; later drops remove it."""
    text = strip_sql_comments((ROOT / "supabase" / "schema.sql").read_bytes().decode("utf8"))
    funcs = {}
    for m in re.finditer(r"(create or replace function|drop function if exists)\s+public\.(\w+)\s*\(", text, re.I):
        kind, name = m.group(1).lower(), m.group(2)
        i, depth = m.end(), 1
        while depth:
            c = text[i]
            depth += (c == "(") - (c == ")")
            i += 1
        body = text[m.end():i - 1]
        if kind.startswith("drop"):
            funcs.pop(name, None)
            continue
        args, defaults = [], set()
        for a in split_top(body):
            a = a.strip()
            if not a:
                continue
            nm = a.split()[0].strip('"')
            args.append(nm)
            if re.search(r"\bdefault\b", a, re.I):
                defaults.add(nm)
        funcs[name] = (args, defaults)
    return funcs


def js_calls(path):
    """yield (line number, function name, argument names or None when none are sent)"""
    text = path.read_text(encoding="utf8")
    for m in re.finditer(r"(?:\.rpc|\bcall|\brows)\(\s*\"(\w+)\"\s*(?:,\s*\{)?", text):
        name = m.group(1)
        line = text.count("\n", 0, m.start()) + 1
        src_line = text.split("\n")[line - 1]
        if "legacy" in src_line:
            continue
        keys = None
        if m.group(0).rstrip().endswith("{"):
            i, depth = m.end(), 1
            while depth:
                c = text[i]
                depth += (c == "{") - (c == "}")
                i += 1
            obj = text[m.end():i - 1]
            keys = []
            for part in split_top(obj):
                part = part.strip()
                if not part or part.startswith("..."):
                    continue
                k = re.match(r"([A-Za-z_]\w*)\s*(?::|$)", part)
                keys.append(k.group(1) if k else part)
        yield line, name, keys


def main():
    funcs = sql_functions()
    bad, seen = [], 0
    for p in sorted((ROOT / "js").glob("*.js")):
        if p.name in ("admin.js", "demo.js"):
            continue
        for line, name, keys in js_calls(p):
            if name not in funcs:
                bad.append(f"{p.name}:{line}: the app calls {name}() but the database has no such function")
                continue
            seen += 1
            args, defaults = funcs[name]
            sent = set(keys or [])
            for k in sent - set(args):
                bad.append(f"{p.name}:{line}: {name}() is sent '{k}' but its arguments are ({', '.join(args)})")
            for a in set(args) - defaults - sent:
                bad.append(f"{p.name}:{line}: {name}() needs '{a}' but the app does not send it")
    if bad:
        print("\n".join(bad))
        print(f"{len(bad)} problem(s)")
        return 1
    print(f"rpc calls match the database ({seen} calls checked)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
