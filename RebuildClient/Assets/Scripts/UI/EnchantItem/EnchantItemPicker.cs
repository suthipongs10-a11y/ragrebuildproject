using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.ClientTypes;
using RebuildSharedData.Enum;
using UnityEngine;

namespace Assets.Scripts.UI.EnchantItem
{
    /// <summary>
    /// The window a scroll opens: pick the thing to write on.
    /// </summary>
    /// <remarks>
    /// Built out of GenericItemListV2 from code rather than as a window of its own. That
    /// prefab is already the game's "choose one of your items" list - the refine counter
    /// opens the same one - and reusing it means this needs no prefab, no scene change and
    /// no editor work to exist.
    ///
    /// The list is everything the server would accept, worked out on this side so the player
    /// is never offered something that will be refused. Each scroll names one equipment slot
    /// and only shows what fits it; the blank scroll names none and shows everything. The
    /// server checks all of it again anyway - this is politeness, not security.
    /// </remarks>
    public class EnchantItemPicker : MonoBehaviour
    {
        /// <summary>
        /// The slot a scroll is written for, read off the end of its item code.
        /// </summary>
        /// <remarks>
        /// Off the code rather than off a table of item ids, because the codes are the one
        /// thing this side and the server side already share. EnchantScrolls builds the same
        /// names from the same two lists, so a scroll either matches on both sides or on
        /// neither, and neither shows up as a window that refuses to list anything rather
        /// than as a scroll quietly landing in the wrong slot.
        /// </remarks>
        private enum ScrollSlot
        {
            Any,
            Weapon,
            Armour,
            Shield,
            HeadTop,
            HeadMid,
            HeadLow,
            Shoes,
            Accessory
        }

        private GenericItemListV2 window;
        private readonly Dictionary<int, int> bagIdByEntry = new Dictionary<int, int>();
        private readonly Dictionary<int, ItemListEntryV2> rowByEntry = new Dictionary<int, ItemListEntryV2>();
        private readonly HashSet<int> blockedEntries = new HashSet<int>();
        private int scrollItemId;
        private ScrollSlot slot;
        private bool isBlank;
        private ItemListEntryV2 selected;
        private int selectedEntry = -1;

        public static void Open(int scrollItemId, ItemData scrollData)
        {
            var state = PlayerState.Instance;
            if (state?.Inventory == null)
                return;

            var prefab = UiManager.Instance.GenericItemListV2Prefab;
            var container = UiManager.Instance.PrimaryUserWindowContainer;
            var go = Instantiate(prefab, container);

            var picker = go.AddComponent<EnchantItemPicker>();
            picker.scrollItemId = scrollItemId;
            picker.slot = SlotFromCode(scrollData.Code);
            picker.isBlank = scrollData.Code == "Ench_Blank";
            picker.window = go.GetComponent<GenericItemListV2>();
            picker.Build(state, scrollData.Name);
        }

        private static ScrollSlot SlotFromCode(string code)
        {
            if (string.IsNullOrEmpty(code))
                return ScrollSlot.Any;

            var cut = code.LastIndexOf('_');
            if (cut < 0)
                return ScrollSlot.Any;

            switch (code.Substring(cut + 1))
            {
                case "Weapon": return ScrollSlot.Weapon;
                case "Armour": return ScrollSlot.Armour;
                case "Shield": return ScrollSlot.Shield;
                case "HeadTop": return ScrollSlot.HeadTop;
                case "HeadMid": return ScrollSlot.HeadMid;
                case "HeadLow": return ScrollSlot.HeadLow;
                case "Shoes": return ScrollSlot.Shoes;
                case "Accessory": return ScrollSlot.Accessory;
                default: return ScrollSlot.Any;
            }
        }

        private static string NameOfSlot(ScrollSlot slot)
        {
            switch (slot)
            {
                case ScrollSlot.Weapon: return "อาวุธ";
                case ScrollSlot.Armour: return "ชุดเกราะ";
                case ScrollSlot.Shield: return "โล่";
                case ScrollSlot.HeadTop: return "ของสวมหัว Top";
                case ScrollSlot.HeadMid: return "ของสวมหัว Middle";
                case ScrollSlot.HeadLow: return "ของสวมหัว Low";
                case ScrollSlot.Shoes: return "รองเท้า";
                case ScrollSlot.Accessory: return "เครื่องประดับ";
                default: return "อุปกรณ์";
            }
        }

        private void Build(PlayerState state, string scrollName)
        {
            window.MoveToTop();
            window.CenterWindow();
            window.ToggleBox.gameObject.SetActive(false);
            window.TitleBar.text = $"เลือก{NameOfSlot(slot)}ที่จะใช้ {scrollName}";
            window.OkButtonText.text = "จาร";
            window.OnPressCancel = Close;
            window.OnPressOk = Confirm;
            window.SetActive();
            ShowHint("คลิกเลือกของหนึ่งชิ้น แล้วกด จาร");

            var entryId = 0;
            foreach (var (_, item) in state.Inventory.GetInventoryData())
            {
                if (!IsEnchantable(item))
                    continue;

                var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(item.ItemData.Sprite);
                var entry = window.GetNewEntry();
                entry.Assign(DragItemType.None, sprite, item.BagSlotId, item.Count);
                entry.UniqueEntryId = entryId;
                entry.ItemName.text = item.ProperName();
                entry.ItemName.rectTransform.anchorMax = new Vector2(1, 1);

                if (state.EquippedBagIdHashes.Contains(item.BagSlotId))
                    entry.SetEquipped();
                else
                    entry.HideCount();

                //A scroll only writes on blank equipment, so what is already on a piece
                //decides whether it can be picked at all. Shown rather than hidden: a ring
                //missing from the list reads as a bug, a ring that says why it cannot be
                //used reads as a rule.
                var existing = ItemEnchants.Get(item.UniqueItem.UniqueId);
                var blocked = isBlank ? existing == null : existing != null;

                if (blocked)
                {
                    blockedEntries.Add(entryId);
                    entry.RightText.text = isBlank
                        ? "<size=-3><color=#7A7480>ไม่มีออพ</color></size>"
                        : $"<size=-3><color=#CC0000>{existing.Options.Count} ออพ · ต้องล้างก่อน</color></size>";
                }
                else
                    entry.RightText.text = isBlank
                        ? $"<size=-3><color=#7A7480>{existing.Options.Count} ออพ</color></size>"
                        : "";

                entry.CanDrag = false;
                entry.CanSelect = true;
                entry.EventOnSelect = Select;
                entry.EventDoubleClick = Pick;

                bagIdByEntry[entryId] = item.BagSlotId;
                rowByEntry[entryId] = entry;
                entryId++;
            }

            if (entryId == 0)
                window.TitleBar.text = EmptyMessage(slot);
        }

        private static string EmptyMessage(ScrollSlot slot) =>
            $"ไม่มี{NameOfSlot(slot)}ที่ใส่ออพได้ในกระเป๋า";

        /// <summary>Only things the server would accept for this particular scroll.</summary>
        /// <remarks>
        /// Position carries the headgear slots as its low three bits, which is how the
        /// exporter writes it, so a hat that covers two slots answers yes to both scrolls
        /// exactly as the server's own check does.
        ///
        /// A two-handed weapon has the off-hand bit set as well, which is what the class
        /// test is guarding: without it every claymore in the bag would show up under the
        /// shield scroll.
        /// </remarks>
        private bool IsEnchantable(InventoryItem item)
        {
            if (!item.ItemData.IsUnique)
                return false;

            var itemClass = item.ItemData.ItemClass;
            if (itemClass != ItemClass.Weapon && itemClass != ItemClass.Equipment)
                return false;

            var pos = item.ItemData.Position;

            switch (slot)
            {
                case ScrollSlot.Any:
                    return true;
                case ScrollSlot.Weapon:
                    return itemClass == ItemClass.Weapon;
                case ScrollSlot.Shield:
                    return itemClass == ItemClass.Equipment && (pos & EquipPosition.OffHand) != 0;
                case ScrollSlot.Armour:
                    return (pos & EquipPosition.Body) != 0;
                //Highest layer only. A hat covering the top and the middle is a top hat as
                //far as a scroll is concerned - the same rule the equip code uses to pick
                //which slot to put it in, and the same one the server checks.
                case ScrollSlot.HeadTop:
                    return (pos & EquipPosition.HeadUpper) != 0;
                case ScrollSlot.HeadMid:
                    return (pos & EquipPosition.HeadUpper) == 0 && (pos & EquipPosition.HeadMid) != 0;
                case ScrollSlot.HeadLow:
                    return (pos & (EquipPosition.HeadUpper | EquipPosition.HeadMid)) == 0
                           && (pos & EquipPosition.HeadLower) != 0;
                case ScrollSlot.Shoes:
                    return (pos & EquipPosition.Footgear) != 0;
                case ScrollSlot.Accessory:
                    return (pos & EquipPosition.Accessory) != 0;
                default:
                    return false;
            }
        }

        /// <summary>
        /// One row at a time.
        /// </summary>
        /// <remarks>
        /// A row paints itself selected on click and nothing ever paints it back, so without
        /// this every row the player tried stayed lit and the window looked like it had
        /// taken all of them. The list keeps no idea of a current selection - the refine
        /// counter tracks its own the same way.
        /// </remarks>
        private void Select(int entryId)
        {
            if (!rowByEntry.TryGetValue(entryId, out var row))
                return;

            if (selected != null && selected != row)
                selected.Unselect();

            selected = row;

            if (blockedEntries.Contains(entryId))
            {
                selectedEntry = -1;
                window.OkButton.interactable = false;
                ShowHint(isBlank
                    ? "<color=#CC0000>ของชิ้นนั้นไม่มีออพให้ล้าง</color>"
                    : "<color=#CC0000>ของชิ้นนี้มีออพอยู่แล้ว</color> ใช้คัมภีร์ล้างออพก่อน แล้วค่อยจารใหม่");
                return;
            }

            selectedEntry = entryId;

            //The prefab ships its ok button switched off, which is the list saying "pick
            //something first" - the refine counter turns it on at exactly this moment and
            //for exactly this reason. Without this the button is not disabled-looking, it
            //is simply unclickable, which reads as the window being broken.
            window.OkButton.interactable = true;

            ShowHint($"จะจารลง <color=#CC5500>{row.ItemName.text}</color> — กด จาร เพื่อยืนยัน");
        }

        private void Confirm()
        {
            if (selectedEntry >= 0)
            {
                Pick(selectedEntry);
                return;
            }

            //The list disarms its own ok button before handing control over, so a press with
            //nothing chosen used to leave a button that could never be pressed again and no
            //hint as to why. Say what is missing and arm it back up.
            ShowHint("<color=#CC0000>เลือกของที่จะจารก่อน</color> แล้วค่อยกด จาร");
            window.SetActive();
        }

        private void ShowHint(string text)
        {
            if (window.InfoAreaText == null)
                return;

            window.InfoAreaText.gameObject.SetActive(true);
            window.InfoAreaText.text = text;
        }

        private void Pick(int entryId)
        {
            if (!bagIdByEntry.TryGetValue(entryId, out var bagId))
                return;

            NetworkManager.Instance.SendEnchantItem(scrollItemId, bagId);
            Close();
        }

        private void Close()
        {
            if (window != null)
                Destroy(window.gameObject);
        }
    }
}
