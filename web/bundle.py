#!/usr/bin/env python3
"""Fold the guide site into one HTML file that works with no server behind it.

    python3 web/bundle.py                  writes web/dist/guide.html
    python3 web/bundle.py somewhere.html   writes it where you say

The site is normally a folder: an index, a stylesheet, a dozen ES modules and twelve
JSON files fetched over HTTP. That is the right shape to work in and the wrong shape to
hand somebody - open index.html off the disk and every fetch fails on the file:// origin,
and there is nowhere to put a folder in a chat message.

So this flattens it. The stylesheet goes inline, the JSON goes in as one object, and the
modules are rewritten into a tiny synchronous loader - the same shape CommonJS uses,
because it is the shape that survives being concatenated.

The rewriting is textual and deliberately narrow: this reads exactly the four forms the
site is written in and nothing else, so a module that starts using a fifth fails loudly
here rather than quietly in the browser.

  import { a, b } from "./x.js"    ->  const { a, b } = require("x.js")
  export function f                ->  function f, plus a getter on the exports
  export const X                   ->  const X, the same
  await import(spec)               ->  require(spec)

The exports are getters written at the top of each module rather than assignments at the
bottom, because the site does have a cycle: app.js finishes by routing, routing requires a
page, and the page requires app.js straight back for its helpers. Getters are what an ES
module's live bindings already are, so the cycle resolves the way it does under a real
module loader. Assigned at the end it does not - the first page to load finds an empty
object where the helpers should have been, and the home page dies on `data is not a
function`.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets")
DATA = os.path.join(ROOT, "data")

IMPORT = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*["\']([^"\']+)["\'];?\s*$', re.M)
EXPORT_FN = re.compile(r'^export\s+(async\s+)?function\s+(\w+)', re.M)
EXPORT_VAR = re.compile(r'^export\s+(?:const|let|var)\s+(\w+)', re.M)
LEFTOVER = re.compile(r'^\s*(?:import|export)\s', re.M)


def canon(path):
    """The key a module is known by: its path under assets/, with forward slashes."""
    return os.path.relpath(path, ASSETS).replace(os.sep, "/")


def resolve(from_key, spec):
    base = os.path.dirname(from_key)
    return os.path.normpath(os.path.join(base, spec)).replace(os.sep, "/")


def modules():
    found = [os.path.join(ASSETS, name) for name in sorted(os.listdir(ASSETS))
             if name.endswith(".js")]
    pages = os.path.join(ASSETS, "pages")
    found += [os.path.join(pages, name) for name in sorted(os.listdir(pages))
              if name.endswith(".js")]
    return found


def rewrite(key, source):
    """One module, as a factory function body plus the names it hands back."""
    names = []
    names += [m.group(2) for m in EXPORT_FN.finditer(source)]
    names += [m.group(1) for m in EXPORT_VAR.finditer(source)]

    #every specifier this module names, rewritten to the key the loader knows it by, so
    #the loader never has to resolve a relative path at run time
    specs = {m.group(2) for m in IMPORT.finditer(source)}
    specs |= set(re.findall(r'import\(\s*["\']([^"\']+)["\']\s*\)', source))
    specs |= set(re.findall(r'page\(\s*["\']([^"\']+)["\']', source))

    body = IMPORT.sub(
        lambda m: 'const {%s} = require("%s");' % (m.group(1), resolve(key, m.group(2))),
        source)

    for spec in specs:
        body = body.replace('"%s"' % spec, '"%s"' % resolve(key, spec))

    body = EXPORT_FN.sub(lambda m: "%sfunction %s" % (m.group(1) or "", m.group(2)), body)
    body = re.sub(r'^export\s+(const|let|var)\s', r'\1 ', body, flags=re.M)
    body = re.sub(r'await\s+import\(', "require(", body)
    body = re.sub(r'(?<![.\w])import\(', "require(", body)

    left = LEFTOVER.search(body)
    if left:
        line = body[:left.start()].count("\n") + 1
        raise SystemExit(f"{key}:{line}: a module form this bundler does not read:\n"
                         f"    {body.splitlines()[line - 1].strip()}")

    if names:
        #Getters, at the top rather than assignments at the bottom, because that is what an
        #ES module's live bindings actually are. app.js finishes by routing, routing
        #requires a page, and that page requires app.js right back - so a module's exports
        #have to be readable while its own body is still running. Assigned at the end they
        #are not, and the first page to load finds an empty object where the helpers should
        #have been.
        block = ",\n  ".join('%s: { get: () => %s, enumerable: true }' % (x, x)
                             for x in names)
        body = "Object.defineProperties(__exports, {\n  %s,\n});\n\n%s" % (block, body)

    return body


def patch_app(body):
    """The one place the site reaches for the network, pointed at the inlined data."""
    before = 'const p = fetch(`data/${name}.json`)'
    after = ('const p = Promise.resolve({\n'
             '    ok: window.__RAGDATA[name] !== undefined,\n'
             '    status: 404,\n'
             '    json: () => window.__RAGDATA[name],\n'
             '  })')
    if before not in body:
        raise SystemExit("app.js no longer fetches data the way this bundler expects")
    return body.replace(before, after, 1)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "guide.html")

    index = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(ASSETS, "style.css"), encoding="utf-8").read()

    store = {}
    for name in sorted(os.listdir(DATA)):
        if name.endswith(".json"):
            store[name[:-5]] = json.load(open(os.path.join(DATA, name), encoding="utf-8"))

    parts = []
    for path in modules():
        key = canon(path)
        body = open(path, encoding="utf-8").read()
        if key == "app.js":
            body = patch_app(body)
        parts.append('__defs["%s"] = function (__exports, require) {\n%s\n};'
                     % (key, rewrite(key, body)))

    #< is escaped so that nothing inside a description can close the script element early
    blob = json.dumps(store, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

    loader = """
const __defs = {};
const __cache = {};
function require(key) {
  if (__cache[key]) return __cache[key];
  const mod = (__cache[key] = {});
  if (!__defs[key]) throw new Error("no module " + key);
  __defs[key](mod, require);
  return mod;
}
%s
require("app.js");
""" % "\n\n".join(parts)

    #the stylesheet and the fonts, in that order, so a font that fails still leaves a
    #styled page rather than an unstyled one
    head = index
    head = head.replace('<link rel="stylesheet" href="assets/style.css">',
                        "<style>\n%s\n</style>" % css)
    head = head.replace('<script type="module" src="assets/app.js"></script>',
                        '<script>window.__RAGDATA = %s;</script>\n<script>%s</script>'
                        % (blob, loader))

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as handle:
        handle.write(head)

    size = os.path.getsize(out)
    print(f"{out}  {size / 1024 / 1024:.1f} MB  "
          f"({len(parts)} module(s), {len(store)} data file(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
