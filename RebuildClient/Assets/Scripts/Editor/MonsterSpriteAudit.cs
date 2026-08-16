using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Assets.Scripts.Sprites;
using RebuildSharedData.ClientTypes;
using UnityEditor;
using UnityEngine;

namespace Assets.Scripts.Editor
{
    /// <summary>
    /// Says which monsters have no sprite, all of them at once.
    ///
    /// A monster whose sprite cannot be found is not an error you can see: the client draws
    /// a Poring in its place, so the only clue is a body that does not match the name over
    /// it, and you only find that by walking into it. Verit in the pyramids is how this one
    /// was found. Checking them one at a time is not a plan when there are hundreds, so
    /// this reads the same monster table the client reads and looks for each file where the
    /// client would look for it.
    ///
    /// Nothing is repaired here, and nothing can be: a missing sprite means the file was
    /// not extracted from the GRF, which happens outside Unity. What this gives you is the
    /// list to extract.
    /// </summary>
    public static class MonsterSpriteAudit
    {
        private const string MonsterClassDataPath = "ClientConfigGenerated/monsterclass.json";

        /// <summary>
        /// Where the upstream author's own monsters start.
        ///
        /// They are behind the DoddlerCustomMonsters flag, which is off here and stays off,
        /// because most of them have no sprite in the GRF and turning it on makes them all
        /// Porings. A missing sprite above this id is therefore the arrangement working, not
        /// a gap to go and fill, and reporting it as one sends you looking through a GRF for
        /// a file that was never in it.
        /// </summary>
        private const int CustomMonsterIdStart = 6000;

        [MenuItem("Ragnarok/Check monster sprites", priority = 3)]
        public static void Audit()
        {
            var dataPath = Path.Combine(Application.streamingAssetsPath, MonsterClassDataPath);
            if (!File.Exists(dataPath))
            {
                Debug.LogError($"[MonsterSpriteAudit] No monster table at {dataPath}. "
                               + "That file is written by updateclient.bat, so run it first.");
                return;
            }

            Wrapper<MonsterClassData> table;
            try
            {
                table = JsonUtility.FromJson<Wrapper<MonsterClassData>>(File.ReadAllText(dataPath));
            }
            catch (Exception e)
            {
                Debug.LogError($"[MonsterSpriteAudit] Could not read the monster table: {e.Message}");
                return;
            }

            if (table?.Items == null || table.Items.Length == 0)
            {
                Debug.LogError("[MonsterSpriteAudit] The monster table is empty.");
                return;
            }

            //the sprite paths the client uses start at Assets/, which is one level above
            //Application.dataPath. Spelled out rather than leaning on the working directory
            //happening to be the project folder.
            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));

            var missing = new List<MonsterClassData>();
            var switchedOff = new List<MonsterClassData>();
            var wrongFolder = new List<string>();
            var checkedCount = 0;

            foreach (var monster in table.Items)
            {
                if (string.IsNullOrWhiteSpace(monster.SpriteName))
                    continue;

                //a handful of entries are built from a prefab rather than a sprite, and
                //those live somewhere else entirely
                if (monster.SpriteName.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase))
                    continue;

                checkedCount++;

                //the same two folders the client searches, in the same order
                var expected = monster.Id < 4000
                    ? ClientDataLoader.NpcSpritePath
                    : ClientDataLoader.MonsterSpritePath;
                var other = expected == ClientDataLoader.NpcSpritePath
                    ? ClientDataLoader.MonsterSpritePath
                    : ClientDataLoader.NpcSpritePath;

                if (File.Exists(Path.Combine(projectRoot, expected + monster.SpriteName)))
                    continue;

                if (File.Exists(Path.Combine(projectRoot, other + monster.SpriteName)))
                {
                    wrongFolder.Add($"{monster.Name} ({monster.Id}) — {monster.SpriteName} is in {other}");
                    continue;
                }

                if (monster.Id >= CustomMonsterIdStart)
                    switchedOff.Add(monster);
                else
                    missing.Add(monster);
            }

            if (missing.Count == 0)
            {
                Debug.Log($"[MonsterSpriteAudit] All {checkedCount} monsters that can appear have a sprite. "
                          + "Nothing to do.");
            }
            else
            {
                var report = new StringBuilder();
                report.AppendLine($"[MonsterSpriteAudit] {missing.Count} of {checkedCount} monsters have no sprite "
                                  + "and will be drawn as a Poring. Extract these from the GRF:");
                foreach (var monster in missing)
                    report.AppendLine($"  {monster.SpriteName}   ({monster.Name}, id {monster.Id})");

                Debug.LogWarning(report.ToString());

                //the console truncates a long message, and this list is meant to be worked
                //through rather than read once
                var outPath = Path.Combine(Application.dataPath, "../MissingMonsterSprites.txt");
                File.WriteAllText(outPath, report.ToString());
                Debug.Log($"[MonsterSpriteAudit] Full list written to {Path.GetFullPath(outPath)}");
            }

            //Said once, quietly, and never as a warning. These cannot appear in the game: the
            //custom monsters are behind a feature flag that is off, and most of them have no
            //sprite in the GRF at all, which is exactly why it is off. Reported at all only
            //so that a future run of this does not look like it missed something.
            if (switchedOff.Count > 0)
            {
                var names = new StringBuilder();
                foreach (var monster in switchedOff)
                    names.Append($"{monster.Name} ({monster.Id}), ");

                Debug.Log($"[MonsterSpriteAudit] {switchedOff.Count} custom monster(s) of id "
                          + $"{CustomMonsterIdStart}+ also have no sprite, which is expected and not a "
                          + "problem: they are behind the DoddlerCustomMonsters flag and it is off. "
                          + $"{names.ToString().TrimEnd(' ', ',')}");
            }

            //found where the client would not have looked, which is worth knowing separately
            //because the file is there and only the folder is wrong
            foreach (var line in wrongFolder)
                Debug.LogWarning($"[MonsterSpriteAudit] {line}");
        }
    }
}
