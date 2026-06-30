#!/usr/bin/env python3
"""Fix JSON files where Chinese string values contain unescaped ASCII double quotes.
Converts inside-string `"` to alternating Chinese curly quotes (U+201C / U+201D).
"""
import sys, json
from pathlib import Path


def fix(src: str) -> str:
    out = []
    i = 0
    in_str = False
    toggle = True
    N = len(src)
    while i < N:
        c = src[i]
        if not in_str:
            out.append(c)
            if c == '"':
                in_str = True
            i += 1
            continue
        if c == '\\':
            out.append(c)
            if i + 1 < N:
                out.append(src[i + 1])
            i += 2
            continue
        if c == '"':
            j = i + 1
            while j < N and src[j] in ' \t\r\n':
                j += 1
            if j < N and src[j] in ',}]:':
                out.append(c)
                in_str = False
                toggle = True
                i += 1
                continue
            out.append('\u201C' if toggle else '\u201D')
            toggle = not toggle
            i += 1
            continue
        out.append(c)
        i += 1
    return ''.join(out)


def main():
    paths = sys.argv[1:]
    for p in paths:
        src = Path(p).read_text(encoding='utf-8')
        new = fix(src)
        try:
            json.loads(new)
        except Exception as e:
            print(f"FAIL {p}: {e}")
            continue
        Path(p).write_text(new, encoding='utf-8')
        print(f"OK {p}")


if __name__ == '__main__':
    main()
