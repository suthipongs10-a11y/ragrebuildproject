# tools/check

Seven checks that stand in for a compiler.

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
| `forgename.py` | What a forged weapon ends up called, assembled from the item's slots, a row of `NonCardPrefixes.csv` and a name sent separately. The order is the whole point - "Very Very Strong Halo's Fire Blade", not "Fire Very Very Strong Halo's Blade" - and it is one integer column away from being wrong in a way nobody notices until they make one. |

`nsresolve.py` takes a list of files; the rest take none (except `needsupdate.py`, which
takes a git range).

None of them is a compiler. They catch the classes of mistake that have cost this project a
build round, and nothing else.
