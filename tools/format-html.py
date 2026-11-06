"""format-html.py — safe HTML formatter for index.html and the legal pages.
Usage: python3 tools/format-html.py IN.html OUT.html

Safe HTML formatter: puts block elements on their own lines with indentation.
It only inserts whitespace between block-level children of a block-level parent whose
children are all blocks (or whitespace / comments). Text and inline content are copied
exactly as they are, so translations and inline spacing cannot change."""
import sys
from html.parser import HTMLParser

BLOCK = {"html", "head", "body", "div", "main", "aside", "nav", "p", "details", "summary", "h1", "h2", "h3",
         "svg", "line", "rect", "script", "meta", "link", "title"}
VOID = {"meta", "link", "input", "br", "img", "hr"}


class Node:
    def __init__(self, tag, start="", end="", kind="el"):
        self.tag, self.start, self.end, self.kind, self.kids = tag, start, end, kind, []


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node("#root")
        self.stack = [self.root]

    def handle_decl(self, d):
        self.stack[-1].kids.append(Node("#decl", f"<!{d}>", kind="raw"))

    def handle_starttag(self, tag, attrs):
        n = Node(tag, self.get_starttag_text())
        self.stack[-1].kids.append(n)
        if tag not in VOID:
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(Node(tag, self.get_starttag_text(), kind="el"))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack[i].end = f"</{tag}>"
                del self.stack[i:]
                return
        raise ValueError("unmatched </%s>" % tag)

    def handle_data(self, d):
        self.stack[-1].kids.append(Node("#text", d, kind="text"))

    def handle_entityref(self, name):
        self.stack[-1].kids.append(Node("#text", f"&{name};", kind="text"))

    def handle_charref(self, name):
        self.stack[-1].kids.append(Node("#text", f"&#{name};", kind="text"))

    def handle_comment(self, d):
        self.stack[-1].kids.append(Node("#comment", f"<!--{d}-->", kind="raw"))


def raw(n):
    if n.kind in ("text", "raw"):
        return n.start
    return n.start + "".join(raw(k) for k in n.kids) + n.end


def isblock(n):
    return n.kind == "el" and n.tag in BLOCK


def out(n, ind, lines):
    """Block element with at least one block child: each block child on its own line;
    runs of text/inline elements between them are copied exactly, on their own line."""
    pad = "  " * ind
    if n.kind == "el" and n.tag in BLOCK and n.tag not in VOID and any(isblock(k) for k in n.kids):
        lines.append(pad + n.start)
        run = []

        def flush():
            # whitespace-only text at the edges of a run sits next to a block: drop it
            while run and run[0].kind == "text" and not run[0].start.strip():
                run.pop(0)
            while run and run[-1].kind == "text" and not run[-1].start.strip():
                run.pop()
            txt = "".join(raw(k) for k in run)
            if txt.strip():
                lines.append("  " * (ind + 1) + txt)
            run.clear()

        for k in n.kids:
            at_edge = all(r.kind == "text" and not r.start.strip() for r in run)
            if isblock(k) or (k.kind == "raw" and at_edge):
                flush()
                out(k, ind + 1, lines)
            else:
                run.append(k)
        flush()
        lines.append(pad + n.end)
    else:
        lines.append(pad + raw(n))


src = open(sys.argv[1], encoding="utf-8").read()
p = P()
p.feed(src)
p.close()
lines = []
for k in p.root.kids:
    if k.kind == "text" and not k.start.strip():
        continue
    out(k, 0, lines)
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(lines) + "\n")
