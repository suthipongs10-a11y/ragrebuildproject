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
            AccLeft,
            AccRight
        }

        private GenericItemListV2 window;
        private readonly Dictionary<int, int> bagIdByEntry = new Dictionary<int, int>();
        private int scrollItemId;
        private ScrollSlot slot;
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
                case "AccLeft": return ScrollSlot.AccLeft;
                case "AccRight": return ScrollSlot.AccRight;
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
                case ScrollSlot.AccLeft: return "เครื่องประดับช่องซ้าย";
                case ScrollSlot.AccRight: return "เครื่องประดับช่องขวา";
                default: return "อุปกรณ์";
            }
        }

        private void Build(PlayerState state, string scrollName)
        {
            window.MoveToTop();
            window.CenterWindow();
            window.ToggleBox.gameObject.SetActive(false);
            window.InfoAreaText.gameObject.SetActive(false);
            window.TitleBar.text = $"เลือก{NameOfSlot(slot)}ที่จะใช้ {scrollName}";
            window.OkButtonText.text = "จาร";
            window.OnPressCancel = Close;
            window.OnPressOk = Confirm;
            window.SetActive();

            var entryId = 0;
            foreach (var (_, item) in state.Inventory.GetInventoryData())
            {
                if (!IsEnchantable(state, item))
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

                //What is already on it, so nobody overwrites a good roll by accident.
                var existing = ItemEnchants.Get(item.UniqueItem.UniqueId);
                entry.RightText.text = existing == null ? "" : $"{existing.Options.Count} ออพ";

                entry.CanDrag = false;
                entry.CanSelect = true;
                entry.EventOnSelect = Select;
                entry.EventDoubleClick = Pick;

                bagIdByEntry[entryId] = item.BagSlotId;
                entryId++;
            }

            if (entryId == 0)
                window.TitleBar.text = EmptyMessage(slot);
        }

        private static string EmptyMessage(ScrollSlot slot)
        {
            if (slot == ScrollSlot.AccLeft || slot == ScrollSlot.AccRight)
            {
                var side = slot == ScrollSlot.AccLeft ? "ซ้าย" : "ขวา";
                return $"ต้องสวมเครื่องประดับไว้ที่ช่อง{side}ก่อน";
            }

            return $"ไม่มี{NameOfSlot(slot)}ที่ใส่ออพได้ในกระเป๋า";
        }

        /// <summary>Only things the server would accept for this particular scroll.</summary>
        /// <remarks>
        /// Position carries the headgear slots as its low three bits, which is how the
        /// exporter writes it, so a hat that covers two slots answers yes to both scrolls
        /// exactly as the server's own check does.
        ///
        /// A two-handed weapon has the off-hand bit set as well, which is what the class
        /// test is guarding: without it every claymore in the bag would show up under the
        /// shield scroll.
        ///
        /// The two accessory scrolls name a side, and nothing about a ring says which side
        /// it belongs on, so the only thing that can answer is what the player is wearing.
        /// </remarks>
        private bool IsEnchantable(PlayerState state, InventoryItem item)
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
                case ScrollSlot.HeadTop:
                    return (pos & EquipPosition.HeadUpper) != 0;
                case ScrollSlot.HeadMid:
                    return (pos & EquipPosition.HeadMid) != 0;
                case ScrollSlot.HeadLow:
                    return (pos & EquipPosition.HeadLower) != 0;
                case ScrollSlot.Shoes:
                    return (pos & EquipPosition.Footgear) != 0;
                case ScrollSlot.AccLeft:
                    return (pos & EquipPosition.Accessory) != 0
                           && state.EquippedItems[(int)EquipSlot.Accessory1] == item.BagSlotId;
                case ScrollSlot.AccRight:
                    return (pos & EquipPosition.Accessory) != 0
                           && state.EquippedItems[(int)EquipSlot.Accessory2] == item.BagSlotId;
                default:
                    return false;
            }
        }

        private void Select(int entryId) => selectedEntry = entryId;

        private void Confirm()
        {
            if (selectedEntry >= 0)
                Pick(selectedEntry);
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
