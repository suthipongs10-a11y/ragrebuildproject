#!/usr/bin/env python3
"""Find scenes and prefabs holding a component whose script cannot be one.

Unity reports this at load time as

    'X' is missing the class attribute 'ExtensionOfNativeClass'!

which reads like a compile problem and is not one. It means a scene or prefab
still carries a MonoBehaviour entry pointing at a class that no longer derives
from MonoBehaviour - typically because somebody turned a component into a plain
class and left the old prefabs behind. The class is fine; the asset is stale.

The check is deliberately narrow. It only reports a script when the class it
resolves to is defined in this project AND its whole base chain is visible here
AND that chain ends without reaching a Unity component type. A class extending
something from an assembly we cannot see is left alone, because guessing there
is how a checker earns a reputation for crying wolf.

    python3 tools/check/deadscripts.py           report
    python3 tools/check/deadscripts.py --fix     strip the dead entries

Exit code is the number of stale entries found.
"""

import os
import re
import sys
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(ROOT, "RebuildClient", "Assets")

# Folders that come out of the player's own data.grf extract - never ours to read.
SKIP_DIRS = {"Sprites", "Maps", "Sounds", "Music", "Plugins", "Library", "Temp", "obj"}

ASSET_EXT = (".prefab", ".unity", ".asset")

# Anything deriving from one of these is a legitimate component or asset.
UNITY_ROOTS = {
    "MonoBehaviour", "ScriptableObject", "StateMachineBehaviour", "NetworkBehaviour",
    "Editor", "EditorWindow", "ScriptableWizard", "PropertyDrawer", "AssetPostprocessor",
    "ScriptableRendererFeature", "ScriptableRenderPass", "AssetImporter",
    "ScriptedImporter", "PlayerLoopSystem", "VolumeComponent", "Graphic",
    "MaskableGraphic", "Selectable", "UIBehaviour", "Image", "Text", "Button",
    "TMP_Text", "TextMeshProUGUI", "Renderer", "Collider", "PlayableAsset",
    "PlayableBehaviour", "RendererFeature", "SerializedMonoBehaviour",
}

SCRIPT_REF = re.compile(r"m_Script:\s*\{fileID:\s*11500000,\s*guid:\s*([0-9a-f]{32})")
GUID_LINE = re.compile(r"^guid:\s*([0-9a-f]{32})", re.M)
CLASS_DECL = re.compile(
    r"^\s*(?:public\s+|internal\s+|sealed\s+|abstract\s+|partial\s+|static\s+)*"
    r"class\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?\s*(?::\s*([^{\r\n]+))?",
    re.M,
)


def walk(base, exts):
    for dirpath, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.endswith(exts):
                yield os.path.join(dirpath, f)


def read(path):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


def build_script_index():
    """guid -> (path, class name, base names) for every .cs with a .meta."""
    index = {}
    for path in walk(ASSETS, (".cs",)):
        meta = path + ".meta"
        if not os.path.isfile(meta):
            continue
        m = GUID_LINE.search(read(meta))
        if not m:
            continue
        text = read(path)
        want = os.path.splitext(os.path.basename(path))[0]
        found = None
        for decl in CLASS_DECL.finditer(text):
            # Unity resolves a script asset to the class matching the file name.
            if decl.group(1) == want:
                found = (want, base_of(decl.group(2) or ""))
                break
        index[m.group(1)] = (path, found)
    return index


def base_of(tail):
    """First base name out of a `: Base, IFoo where T : X` tail."""
    tail = re.split(r"\bwhere\b", tail)[0]
    first = tail.split(",")[0].strip()
    return re.sub(r"<.*", "", first).strip()


def build_class_bases():
    """class name -> base name, across every class in the project.

    A partial class splits its declaration across files and only one part names
    the base, so keep the first non-empty answer rather than the first answer -
    otherwise the half without the base decides and every partial component looks
    like a plain class.
    """
    bases = {}
    for path in walk(ASSETS, (".cs",)):
        for decl in CLASS_DECL.finditer(read(path)):
            name = decl.group(1)
            base = base_of(decl.group(2) or "")
            if base or name not in bases:
                if bases.get(name):
                    continue
                bases[name] = base
    return bases


def is_component(class_name, bases, seen=None):
    """True if the chain reaches a Unity type, None if it leaves the project."""
    seen = seen or set()
    current = class_name
    while current and current not in seen:
        seen.add(current)
        base = bases.get(current)
        if base is None:
            return None            # class we cannot see - say nothing
        if not base:
            return False           # explicitly derives from nothing
        if base in UNITY_ROOTS:
            return True
        if base not in bases:
            return None            # base lives in an assembly we cannot read
        current = base
    return None


def first_component_class(text, bases):
    """The first class in a file that really is a component, if any."""
    for decl in CLASS_DECL.finditer(text):
        name = decl.group(1)
        if is_component(name, bases):
            return name
    return None


def strip_entries(text, anchors):
    """Remove whole YAML documents by anchor, plus the m_Component lines naming them."""
    docs = re.split(r"(?m)^(?=--- !u!)", text)
    keep = []
    for doc in docs:
        m = re.match(r"--- !u!\d+ &(\d+)", doc)
        if m and m.group(1) in anchors:
            continue
        keep.append(doc)
    out = "".join(keep)
    for anchor in anchors:
        out = re.sub(r"(?m)^\s*- component: \{fileID: %s\}\r?\n" % anchor, "", out)
    return out


def main():
    fix = "--fix" in sys.argv
    scripts = build_script_index()
    bases = build_class_bases()

    # Two different faults with two different remedies, so keep them apart.
    # DEAD  - the class cannot be a component; the asset entry has to go.
    # RENAME - the class is a real component but the file is named something else,
    #          so Unity cannot resolve the script. Renaming the file fixes it and
    #          stripping the entry would throw away a working component.
    verdict = {}
    for guid, (path, found) in scripts.items():
        if found is None:
            real = first_component_class(read(path), bases)
            verdict[guid] = ("RENAME", path,
                             f"file is named {os.path.basename(path)} but the class is "
                             f"{real or 'something else'}" if real else
                             "no class matching the file name")
            continue
        name, _ = found
        if is_component(name, bases) is False:
            verdict[guid] = ("DEAD", path, f"class {name} derives from nothing")

    problems = defaultdict(list)
    for asset in walk(ASSETS, ASSET_EXT):
        text = read(asset)
        anchors = set()
        for doc in re.split(r"(?m)^(?=--- !u!)", text):
            m = re.match(r"--- !u!114 &(\d+)", doc)
            if not m:
                continue
            ref = SCRIPT_REF.search(doc)
            if not ref:
                continue
            guid = ref.group(1)
            if guid in verdict:
                kind, path, why = verdict[guid]
                if kind == "DEAD":
                    anchors.add(m.group(1))
                problems[asset].append((kind, path, why))
        if anchors and fix:
            fixed = strip_entries(text, anchors)
            for anchor in anchors:
                if re.search(r"fileID: %s\b" % anchor, fixed):
                    print(f"  ! {os.path.relpath(asset, ROOT)} still references "
                          f"{anchor} elsewhere - left alone")
                    break
            else:
                with open(asset, "w", encoding="utf-8", newline="") as fh:
                    fh.write(fixed)

    total = sum(len(v) for v in problems.values())
    if not total:
        print("every component in a scene or prefab points at a class that can be one")
        return 0

    dead = sum(1 for hits in problems.values() for k, _, _ in hits if k == "DEAD")
    rename = total - dead

    print(f"{total} unresolvable component entr{'y' if total == 1 else 'ies'} "
          f"in {len(problems)} asset(s):\n")
    for asset, hits in sorted(problems.items()):
        print(f"  {os.path.relpath(asset, ROOT)}")
        for kind, path, why in hits:
            print(f"      [{kind}] {why}")
            print(f"             {os.path.relpath(path, ROOT)}")

    if dead:
        print(f"\n{dead} [DEAD] - the class cannot be a component, so the entry is "
              f"dead weight.")
        print("      " + ("removed" if fix else "run with --fix to strip them"))
    if rename:
        print(f"\n{rename} [RENAME] - the component is real but Unity cannot find it, "
              f"because")
        print("      a script file has to be named after its class. --fix leaves these")
        print("      alone; rename the .cs and its .meta together so the guid survives.")
    if fix and dead:
        print("\nreopen the project so Unity rewrites its cache")
    return total


if __name__ == "__main__":
    sys.exit(main())
