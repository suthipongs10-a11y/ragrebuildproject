using System;
using System.Collections.Generic;
using System.IO;
using Assets.Scripts.Sprites;
using RebuildSharedData.ClientTypes;
using UnityEditor;
using UnityEngine;

namespace Assets.Scripts.Editor
{
    /// <summary>
    /// Reimports one sprite, by name, instead of all of them.
    ///
    /// Reimporting the sprite folder is enormously expensive and almost never what is
    /// wanted. Every .act in it is rebuilt into a packed atlas of up to 2048 by 2048 and a
    /// data asset holding one Sprite object per frame, both written into
    /// Assets/Sprites/Imported; Unity then imports each of those atlases in turn and keeps
    /// its own compressed copy under Library/Artifacts, per build target. Doing that for
    /// hundreds of monsters to fix one of them is how a disk fills up.
    ///
    /// This calls the same importer the folder reimport calls, on one file. Finding the
    /// file is the part worth automating: the sprite is named in the monster table rather
    /// than after the monster, and a good number of them are Korean, so typing the monster's
    /// name and having it resolved is the difference between a moment and a hunt.
    /// </summary>
    public class SpriteReimportWindow : EditorWindow
    {
        private const string MonsterClassDataPath = "ClientConfigGenerated/monsterclass.json";

        private string search = "";
        private string status = "";
        private readonly List<string> matches = new List<string>();

        [MenuItem("Ragnarok/Reimport one sprite", priority = 4)]
        public static void Open()
        {
            var window = GetWindow<SpriteReimportWindow>(true, "Reimport one sprite");
            window.minSize = new Vector2(460, 300);
            window.Show();
        }

        private void OnGUI()
        {
            EditorGUILayout.LabelField("Rebuilds one sprite rather than the whole folder.",
                EditorStyles.wordWrappedLabel);
            EditorGUILayout.Space();

            using (new EditorGUILayout.HorizontalScope())
            {
                search = EditorGUILayout.TextField("Monster or file", search);
                if (GUILayout.Button("Find", GUILayout.Width(60)))
                    Find(search);
            }

            EditorGUILayout.LabelField("A monster name (Verit), a sprite file (verit.spr), "
                                       + "or part of either.", EditorStyles.miniLabel);

            EditorGUILayout.Space();

            if (GUILayout.Button("Reimport whatever is selected in the Project window"))
                ReimportSelection();

            EditorGUILayout.Space();

            if (matches.Count > 0)
            {
                EditorGUILayout.LabelField($"{matches.Count} match(es)", EditorStyles.boldLabel);
                foreach (var path in matches)
                {
                    using (new EditorGUILayout.HorizontalScope())
                    {
                        EditorGUILayout.LabelField(path, EditorStyles.miniLabel);
                        if (GUILayout.Button("Reimport", GUILayout.Width(80)))
                            Reimport(path);
                    }
                }
            }

            if (!string.IsNullOrEmpty(status))
            {
                EditorGUILayout.Space();
                EditorGUILayout.HelpBox(status, MessageType.Info);
            }
        }

        /// <summary>
        /// Turns whatever was typed into act files that exist.
        ///
        /// Three ways in, tried in order: the monster table, so a monster's own name works;
        /// the file name, for when the sprite is known but the monster is not; and a partial
        /// match on either, because half the sprite names are Korean and nobody is typing
        /// those from memory.
        /// </summary>
        private void Find(string text)
        {
            matches.Clear();
            status = "";

            if (string.IsNullOrWhiteSpace(text))
            {
                status = "Type a monster name or a sprite file name first.";
                return;
            }

            var needle = text.Trim();
            var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var spriteName in SpriteNamesFromMonsterTable(needle))
                AddIfExists(found, spriteName);

            //typed as a file rather than as a monster
            AddIfExists(found, needle);
            AddIfExists(found, needle + ".spr");
            AddIfExists(found, needle + ".act");

            if (found.Count == 0)
                SearchFolders(needle, found);

            matches.AddRange(found);

            if (matches.Count == 0)
                status = $"Nothing matching \"{needle}\" in {ClientDataLoader.MonsterSpritePath} "
                         + $"or {ClientDataLoader.NpcSpritePath}. If the sprite was never "
                         + "extracted from the GRF there is nothing here to reimport.";
        }

        /// <summary>
        /// Sprite file names for monsters whose name matches, read from the same table the
        /// client reads. Returns nothing at all if the table has not been generated yet.
        /// </summary>
        private static IEnumerable<string> SpriteNamesFromMonsterTable(string needle)
        {
            var dataPath = Path.Combine(Application.streamingAssetsPath, MonsterClassDataPath);
            if (!File.Exists(dataPath))
                yield break;

            Wrapper<MonsterClassData> table = null;
            try
            {
                table = JsonUtility.FromJson<Wrapper<MonsterClassData>>(File.ReadAllText(dataPath));
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[SpriteReimport] Could not read the monster table: {e.Message}");
            }

            if (table?.Items == null)
                yield break;

            foreach (var monster in table.Items)
            {
                if (string.IsNullOrWhiteSpace(monster.SpriteName))
                    continue;

                if (monster.Name != null
                    && monster.Name.IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0)
                    yield return monster.SpriteName;
            }
        }

        /// <summary>Adds the .act beside a named sprite, if both the folder and the file are real.</summary>
        private static void AddIfExists(HashSet<string> into, string spriteFile)
        {
            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            var bare = Path.GetFileNameWithoutExtension(spriteFile);

            foreach (var folder in new[] { ClientDataLoader.MonsterSpritePath, ClientDataLoader.NpcSpritePath })
            {
                var relative = folder + bare + ".act";
                if (File.Exists(Path.Combine(projectRoot, relative)))
                    into.Add(relative);
            }
        }

        /// <summary>Last resort: any act file whose own name contains what was typed.</summary>
        private static void SearchFolders(string needle, HashSet<string> into)
        {
            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));

            foreach (var folder in new[] { ClientDataLoader.MonsterSpritePath, ClientDataLoader.NpcSpritePath })
            {
                var full = Path.Combine(projectRoot, folder);
                if (!Directory.Exists(full))
                    continue;

                foreach (var file in Directory.GetFiles(full, "*.act", SearchOption.TopDirectoryOnly))
                {
                    var name = Path.GetFileNameWithoutExtension(file);
                    if (name.IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0)
                        into.Add(folder + Path.GetFileName(file));
                }
            }
        }

        private void ReimportSelection()
        {
            matches.Clear();
            status = "";

            var selected = Selection.GetFiltered<UnityEngine.Object>(SelectionMode.Assets);
            var any = false;

            foreach (var item in selected)
            {
                var path = AssetDatabase.GetAssetPath(item);
                if (string.IsNullOrEmpty(path))
                    continue;

                //A .spr on its own cannot be rebuilt: the act beside it is what says which
                //frames make which animation, and the importer is driven from that end.
                if (path.EndsWith(".spr", StringComparison.OrdinalIgnoreCase))
                    path = Path.ChangeExtension(path, ".act");

                if (!path.EndsWith(".act", StringComparison.OrdinalIgnoreCase))
                    continue;

                Reimport(path);
                any = true;
            }

            if (!any)
                status = "Select a .act or .spr file in the Project window first.";
        }

        private void Reimport(string relativeActPath)
        {
            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            var full = Path.Combine(projectRoot, relativeActPath);

            if (!File.Exists(full))
            {
                status = $"{relativeActPath} is not there.";
                return;
            }

            try
            {
                //Straight into the importer rather than through AssetDatabase.ImportAsset.
                //Reimporting the .act would reach the same code by way of the post processor,
                //and would also make Unity file a fresh artifact for the .act itself; this
                //rebuilds only what the sprite actually needs.
                ActImporter.ImportActFile(relativeActPath);
                AssetDatabase.Refresh();

                status = $"Rebuilt {relativeActPath}.\n"
                         + "Its atlas and data asset under Assets/Sprites/Imported have been "
                         + "written again. Nothing else was touched.";
                Debug.Log($"[SpriteReimport] Rebuilt {relativeActPath}");
            }
            catch (Exception e)
            {
                status = $"{relativeActPath} failed: {e.Message}";
                Debug.LogError($"[SpriteReimport] {relativeActPath} failed: {e}");
            }
        }
    }
}
