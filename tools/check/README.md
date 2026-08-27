# tools/check

Eleven checks that stand in for a compiler.

Unity only compiles when it feels like it, and a mistake that would have taken a compiler a
second to catch instead costs a pull, a build, a script run and a look at the Console -
minutes each time, and the answer arrives in a window nobody was watching. Each of these
guards a mistake that has actually been made in this project, more than once.

Run them from the repo root with `python3 tools/check/<name>.py`.

| | what it catches |
|---|---|
| `nsshadow.py` | `System.Guid` in a file whose folder has a namespace called `System` next to it. C# takes the nearer one, finds no `Guid` in it, and fails naming a namespace nobody typed. |
| `nsresolve.py` | A type used without the using that reaches it. Folders and namespaces do not match here: `OutboundMessage` sits in `Networking/` and is in `RebuildZoneServer.Networking`. |
| `balance.py` | Braces and parens that do not close, usually from an edit that landed a line outside the method it was meant for. |
| `handlers.py` | A client packet handler with no slot in the generated dispatch table. The failure is silent in the worst way: the packet arrives, finds nobody, and the window that was waiting simply waits. |
| `needsupdate.py` | Whether a change makes `updateclient.bat` necessary, and why. Takes a git range, e.g. `needsupdate.py HEAD~3..HEAD`. |
| `unmanaged.py` | A reference field added to a struct that gets stack allocated somewhere. The build stops with CS0208 pointing at the `stackalloc`, which is nowhere near the field that broke it. |
| `contrast.py` | An ink that cannot be read on what it is written on. A retint breaks nothing that compiles: the only sign is a label somebody cannot read on a phone in daylight, which is not something the person who changed it will see on a desk monitor. Holds every ink and surface pairing against the WCAG 2.1 ratio - 4.5 to 1 for text, 3 to 1 for anything drawn. |
| `uitypes.py` | A theme builder's result handed to something that does not take it. CreateCard returns a RectTransform and CreateButton returns a Button; Place takes a RectTransform. All four lines read the same and two of them are only wrong at the transform. |
| `deadscripts.py` | A component in a scene or prefab whose script cannot be one. Unity says `'X' is missing the class attribute 'ExtensionOfNativeClass'!`, which reads like a compile error and is not: the class is fine, the asset is stale, and it happens whenever somebody turns a component into a plain class and leaves the old prefabs behind. Also catches a script file named something other than its class, which Unity cannot resolve at all. `--fix` strips the dead entries and leaves the renames alone, because those are fixed by renaming the file, not by deleting a working component. |
| `npcscript.py` | An npc script that will not load, or a menu that quietly stops working. The scripts are a language of their own, compiled at server startup and touched by no build step, so the first sign of a broken one is the server refusing to start. Checks that braces and parens close, that every `@Macro()` exists, that no `Option()` runs past the ten the client can show, and that a `while(result < n)` menu loop agrees with the number of entries in the menu it wraps - add an entry and forget the bound and the new entries close the conversation instead of returning to it. |
| `forgename.py` | What a forged weapon ends up called, assembled from the item's slots, a row of `NonCardPrefixes.csv` and a name sent separately. The order is the whole point - "Very Very Strong Halo's Fire Blade", not "Fire Very Very Strong Halo's Blade" - and it is one integer column away from being wrong in a way nobody notices until they make one. |

`nsresolve.py` takes a list of files; the rest take none (except `needsupdate.py`, which
takes a git range).

None of them is a compiler. They catch the classes of mistake that have cost this project a
build round, and nothing else.

---

## tools/audit_items.py

Not a check - it does not pass or fail. It reads every item a player can actually get and
holds its description against the effect written for it, and prints what disagrees.

    python3 tools/audit_items.py          the list
    python3 tools/audit_items.py count    the counts only

Two passes. The first finds an item whose description promises something and which has no
effect at all. The second parses the numbers out of the description - `STR +2`, `HP +700` -
and compares them with the `AddStat` calls, so a card that says one and gives ten is found
without anybody reading four hundred cards.

What it knows not to complain about: defence, magic defence and a weapon's attack come off
the item table rather than a script; a set bonus is written as `ComboItem` and belongs to
every item named in it; a line that qualifies its bonus - against demihumans, for swordsmen -
is a different stat and is left to the eye.

What it still gets wrong: flavour prose that happens to contain a verb like "increases" or
"makes" reads as a promise. Six items do this and all six were checked by hand; the list is
short enough to keep reading rather than worth another rule.

## tools/audit_stats.py

Does the server ever read the stat an item writes?

    python3 tools/audit_stats.py

An item effect adds a number to a named stat. Whether that number does anything depends
entirely on somewhere else asking for that stat, and nothing complains if nobody ever does:
the card equips, the number is stored, the tooltip is honest, and the effect does not exist.
This is the failure mode that is impossible to notice by playing - the item looks right in
every window.

It knows that whole families are read by offset rather than by name - the ten attack
elements are asked for as `AddAttackElementNeutral + (int)element` - and takes those families
from the blank lines the enum is grouped by, which is how they are actually written.

Six stats are still named and all six were checked by hand: confusion and bleeding are
statuses the game never applies, and the four self-inflicted ones are read from a flag that
is set and never looked at.

## tools/audit_effects.py

The things an item effect names, and whether they exist.

    python3 tools/audit_effects.py

`audit_stats.py` asks whether a stat is read. This asks the next question down. An effect
that casts a skill, drops an item, applies a status or hits a tagged monster names something,
and naming something is not the same as it being there: a card that auto-casts a skill with
no handler equips cleanly, rolls its chance, and does nothing.

Four checks - skills against the handler list and the passives read off the player, statuses
against the status handlers, bonus drops against the item table, and damage-versus-tag
against the tags column of Monsters.csv.
