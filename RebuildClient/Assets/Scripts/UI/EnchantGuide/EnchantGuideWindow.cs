using System;
using System.Collections.Generic;
using System.Text;
using Assets.Scripts.Sprites;
using RebuildSharedData.ClientTypes;
using UnityEngine;

namespace Assets.Scripts.UI.EnchantGuide
{
    /// <summary>
    /// The scribe's handbook: what a tier costs, where the materials drop, and what the
    /// scroll can roll once you have one.
    /// </summary>
    /// <remarks>
    /// Built out of GenericItemListV2 from code, the same trick the scroll's item picker
    /// uses, because that prefab is the only list in the game that already draws an item
    /// icon beside a line of text - and an icon is the whole reason this is a window rather
    /// than four more paragraphs of npc dialogue.
    ///
    /// Where a material drops is worked out here rather than written down. The client
    /// already ships the monster database the search window reads, drops and spawn maps
    /// included, so the guide reads the same file: a material that changes hands between
    /// monsters updates itself, and a material nothing drops says so out loud instead of
    /// lying quietly.
    /// </remarks>
    public class EnchantGuideWindow : MonoBehaviour
    {
        private const string MonsterDbPath = "ClientConfigGenerated/monsterdatabase.json";
        private const int MaxSourcesShown = 5;

        [Serializable] private class GuideDrop { public int ItemId; public int Chance; }
        [Serializable] private class GuideSpawn { public string Map; public int Count; }

        [Serializable] private class GuideMonster
        {
            public int Id;
            public string Name;
            public int Level;
            public List<GuideDrop> Drops;
            public List<GuideSpawn> Spawns;
        }

        [Serializable] private class GuideMonsterFile { public List<GuideMonster> Items; }

        //Read once and kept. The file is the same one the database window parses and it is
        //not small; opening the guide four times should not parse it four times.
        private static Dictionary<int, List<GuideMonster>> sourcesByItem;

        public static EnchantGuideWindow Instance;

        private GenericItemListV2 window;
        private readonly Dictionary<int, string> detailByEntry = new Dictionary<int, string>();
        private readonly List<ItemListEntryV2> rows = new List<ItemListEntryV2>();
        private readonly Dictionary<int, ItemListEntryV2> rowByEntry = new Dictionary<int, ItemListEntryV2>();
        private ItemListEntryV2 selected;
        private int tier;

        public static void Open(int startTier = 0)
        {
            //Asking for it twice re-uses the one that is up. It may also be hidden rather
            //than gone: the window's own close button hides instead of destroying, so a
            //guide that was closed and asked for again has to be shown before being raised.
            if (Instance != null && Instance.window != null)
            {
                Instance.tier = Mathf.Clamp(startTier, 0, EnchantGuideData.TierCount - 1);
                Instance.window.ShowWindow();
                Instance.window.SetActive();
                Instance.Build();
                Instance.window.MoveToTop();
                return;
            }

            var prefab = UiManager.Instance.GenericItemListV2Prefab;
            var container = UiManager.Instance.PrimaryUserWindowContainer;
            var go = Instantiate(prefab, container);

            var guide = go.AddComponent<EnchantGuideWindow>();
            guide.window = go.GetComponent<GenericItemListV2>();
            guide.tier = Mathf.Clamp(startTier, 0, EnchantGuideData.TierCount - 1);
            Instance = guide;

            guide.window.MoveToTop();
            guide.window.CenterWindow();
            guide.window.ToggleBox.gameObject.SetActive(false);
            guide.window.OnPressCancel = guide.Close;
            guide.window.OnPressOk = guide.NextTier;

            //Without this the title bar's x calls the base hide, which leaves the object
            //alive and this instance pointing at a window nobody can see.
            guide.window.OnCloseWindow = guide.Close;
            guide.window.SetActive();
            guide.Build();
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        private void NextTier()
        {
            tier = (tier + 1) % EnchantGuideData.TierCount;
            Build();

            //The list's ok button disarms itself once pressed so a double click cannot send
            //two of whatever it was submitting. This one is a page turn rather than a
            //submission, so it gets armed again.
            window.SetActive();
        }

        private void Close()
        {
            if (window != null)
                Destroy(window.gameObject);
        }

        private void Build()
        {
            var t = EnchantGuideData.Tiers[tier];

            //No colour tags in the title. The bar behind it is the window chrome's blue and
            //the tier colours are all dark - brown, navy, olive - so a tinted word there is
            //a word nobody can read. The tier gets its colour on the first row instead,
            //where the background is white.
            window.TitleBar.text = "คู่มือออพ — ระดับ" + t.Thai;
            window.OkButtonText.text = "ระดับถัดไป";
            window.CancelButtonText.text = "ปิด";

            //On from the start, unlike the item picker: the prefab ships this button off
            //because its usual job is "submit the thing you chose", and here it is a page
            //turn that is always available.
            window.OkButton.interactable = true;

            window.InfoAreaText.gameObject.SetActive(true);
            window.InfoAreaText.text = "กดที่ชื่อของเพื่อดูว่าดรอปจากมอนตัวไหน แมพอะไร";

            ClearRows();
            BuildSourceIndex();

            var entryId = 0;

            AddTextRow(ref entryId,
                string.Format("<b><color={0}>คัมภีร์ระดับ{1}</color></b>", t.Colour, t.Thai),
                string.Format("ค่าจ้าง {0:n0} zeny", t.Zeny), null);

            var loader = ClientDataLoader.Instance;

            foreach (var mat in t.Materials)
            {
                ItemData itemData = null;
                if (loader != null)
                    loader.TryGetItemByName(mat.Code, out itemData);

                var name = itemData != null ? itemData.Name : mat.Code;
                var sources = itemData != null ? SourcesFor(itemData.Id) : null;

                var entry = NewRow(entryId);
                ShowIcon(entry, true);
                entry.Assign(DragItemType.None, itemData != null ? loader.GetIconAtlasSprite(itemData.Sprite) : null,
                    itemData != null ? itemData.Id : 0, 1);
                entry.HideCount();

                entry.ItemName.text = string.Format("{0} <color=#B08A3A><b>x{1}</b></color>", name, mat.Count);
                entry.RightText.text = ShortSource(sources, mat.Note);

                detailByEntry[entryId] = DetailText(name, mat, sources);
                entryId++;
            }

            //The odds go in the list rather than the text strip under it. The strip is two
            //lines tall and a legendary accessory rolls from eighteen stats; it ran out the
            //bottom of the window and over the game behind it.
            foreach (var row in EnchantGuideData.OddsRows(tier))
                AddTextRow(ref entryId, row.Label, row.Detail, row.IsHeader ? null : row.Label + "   " + row.Detail);
        }

        /// <summary>A row with no icon, for the things that are not items.</summary>
        private void AddTextRow(ref int entryId, string label, string detail, string onClick)
        {
            var entry = NewRow(entryId);
            ShowIcon(entry, false);
            entry.HideCount();
            entry.ItemName.text = label;
            entry.RightText.text = string.IsNullOrEmpty(detail)
                ? ""
                : "<size=-3><color=#7A7480>" + detail + "</color></size>";

            if (!string.IsNullOrEmpty(onClick))
                detailByEntry[entryId] = onClick;

            entryId++;
        }

        /// <summary>
        /// Rows come back off the list's spare pile with whatever the last page left on
        /// them, so both kinds set this rather than only the one that turns it off.
        /// </summary>
        private static void ShowIcon(ItemListEntryV2 entry, bool visible)
        {
            if (entry.ImageDisplayGroup != null)
                entry.ImageDisplayGroup.SetActive(visible);
        }

        /// <summary>The bits every row needs, however it is filled in afterwards.</summary>
        private ItemListEntryV2 NewRow(int entryId)
        {
            var entry = window.GetNewEntry();
            rows.Add(entry);

            entry.ItemName.rectTransform.anchorMax = new Vector2(1, 1);
            entry.CanDrag = false;
            entry.CanSelect = true;
            entry.UniqueEntryId = entryId;
            entry.EventOnSelect = ShowDetail;
            entry.EventDoubleClick = ShowDetail;

            rowByEntry[entryId] = entry;
            return entry;
        }

        /// <summary>
        /// Hands every row back to the list rather than destroying it.
        /// </summary>
        /// <remarks>
        /// Destroy is deferred to the end of the frame, so the rows of the tier being left
        /// would still be on screen underneath the rows of the tier being drawn. Returning
        /// them puts them straight onto the list's own spare pile, which is where the next
        /// page takes them from again.
        /// </remarks>
        private void ClearRows()
        {
            detailByEntry.Clear();
            rowByEntry.Clear();
            selected = null;

            foreach (var row in rows)
            {
                row.EventOnSelect = null;
                row.EventDoubleClick = null;
                window.ReturnItemListEntry(row);
            }

            rows.Clear();
        }

        /// <summary>
        /// One row lit at a time, and whatever it has to say goes under the list.
        /// </summary>
        /// <remarks>
        /// A row paints itself selected on click and nothing paints it back, so without the
        /// unselect every row anybody had ever tried stayed lit.
        /// </remarks>
        private void ShowDetail(int entryId)
        {
            if (rowByEntry.TryGetValue(entryId, out var row))
            {
                if (selected != null && selected != row)
                    selected.Unselect();

                selected = row;
            }

            if (detailByEntry.TryGetValue(entryId, out var text))
                window.InfoAreaText.text = text;
        }

        private static string ShortSource(List<GuideMonster> sources, string note)
        {
            if (!string.IsNullOrEmpty(note))
                return "<size=-3>" + note + "</size>";

            if (sources == null || sources.Count == 0)
                return "";

            return string.Format("<size=-3><color=#7A7480>{0}{1}</color></size>",
                sources[0].Name, sources.Count > 1 ? " +" + (sources.Count - 1) : "");
        }

        private string DetailText(string name, GuideMaterial mat, List<GuideMonster> sources)
        {
            var t = EnchantGuideData.Tiers[tier];
            var sb = new StringBuilder();

            sb.Append("<b>").Append(name).Append("</b>  <color=#B08A3A>x").Append(mat.Count).Append("</color>");
            sb.Append("  <size=-3><color=#7A7480>สำหรับคัมภีร์ระดับ").Append(t.Thai).Append(" หนึ่งใบ</color></size>\n");

            if (!string.IsNullOrEmpty(mat.Note))
                sb.Append("<color=#B08A3A>").Append(mat.Note).Append("</color>\n");

            sb.Append('\n');

            if (sources == null || sources.Count == 0)
            {
                sb.Append("<color=#7A7480>ไม่มีมอนตัวไหนดรอปของชิ้นนี้ — ได้จากทางอื่น เช่น กล่อง ร้านค้า หรือระบบย่อย</color>");
                return sb.ToString();
            }

            sb.Append("<b>ดรอปจาก</b>\n");

            var shown = 0;
            foreach (var mon in sources)
            {
                if (shown >= MaxSourcesShown)
                    break;

                sb.Append("  ").Append(mon.Name).Append(" <size=-3><color=#7A7480>lv ").Append(mon.Level).Append("</color></size>");
                sb.Append("   <color=#7A7480>").Append(MapsOf(mon)).Append("</color>\n");
                shown++;
            }

            if (sources.Count > shown)
                sb.Append("  <size=-3><color=#7A7480>และอีก ").Append(sources.Count - shown).Append(" ตัว</color></size>\n");

            return sb.ToString();
        }

        private static string MapsOf(GuideMonster mon)
        {
            if (mon.Spawns == null || mon.Spawns.Count == 0)
                return "ไม่มีจุดเกิดในเซิร์ฟเวอร์นี้";

            var loader = ClientDataLoader.Instance;
            var sb = new StringBuilder();
            var shown = 0;

            foreach (var spawn in mon.Spawns)
            {
                if (shown >= 2)
                    break;

                var info = loader != null ? loader.GetMapInfo(spawn.Map) : null;
                if (shown > 0)
                    sb.Append(" · ");
                sb.Append(info != null && !string.IsNullOrEmpty(info.Name) ? info.Name : spawn.Map);
                shown++;
            }

            if (mon.Spawns.Count > shown)
                sb.Append(" +").Append(mon.Spawns.Count - shown);

            return sb.ToString();
        }

        private static List<GuideMonster> SourcesFor(int itemId)
        {
            if (sourcesByItem == null)
                return null;

            return sourcesByItem.TryGetValue(itemId, out var list) ? list : null;
        }

        /// <summary>
        /// Turns the monster database inside out once: item id to the things that drop it.
        /// </summary>
        /// <remarks>
        /// Only hundred percent drops. Everything the recipes ask for is a guaranteed drop
        /// by design - that was the whole point of picking them - so a rarer source in the
        /// list would be a red herring rather than help.
        /// </remarks>
        private static void BuildSourceIndex()
        {
            if (sourcesByItem != null)
                return;

            sourcesByItem = new Dictionary<int, List<GuideMonster>>();

            var json = ClientDataLoader.ReadStreamingAssetFile(MonsterDbPath);
            if (string.IsNullOrEmpty(json))
            {
                Debug.LogWarning("[EnchantGuide] " + MonsterDbPath + " is missing, so the guide cannot say where anything drops.");
                return;
            }

            GuideMonsterFile db;
            try
            {
                db = JsonUtility.FromJson<GuideMonsterFile>(json);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[EnchantGuide] could not read " + MonsterDbPath + ": " + e.Message);
                return;
            }

            if (db == null || db.Items == null)
                return;

            foreach (var mon in db.Items)
            {
                if (mon.Drops == null)
                    continue;

                foreach (var drop in mon.Drops)
                {
                    if (drop.Chance < 10000)
                        continue;

                    if (!sourcesByItem.TryGetValue(drop.ItemId, out var list))
                    {
                        list = new List<GuideMonster>();
                        sourcesByItem.Add(drop.ItemId, list);
                    }

                    list.Add(mon);
                }
            }

            foreach (var pair in sourcesByItem)
                pair.Value.Sort((a, b) => a.Level.CompareTo(b.Level));
        }
    }
}
