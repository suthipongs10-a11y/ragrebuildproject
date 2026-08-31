using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.UI.ItemList;
using Assets.Scripts.Utility;
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
    /// is never offered something that will be refused: unique items only, weapons, armour
    /// and accessories only. The server checks all of it again anyway - this is politeness,
    /// not security.
    /// </remarks>
    public class EnchantItemPicker : MonoBehaviour
    {
        private GenericItemListV2 window;
        private readonly Dictionary<int, int> bagIdByEntry = new Dictionary<int, int>();
        private int scrollItemId;
        private int selectedEntry = -1;

        public static void Open(int scrollItemId, string scrollName)
        {
            var state = PlayerState.Instance;
            if (state?.Inventory == null)
                return;

            var prefab = UiManager.Instance.GenericItemListV2Prefab;
            var container = UiManager.Instance.PrimaryUserWindowContainer;
            var go = Instantiate(prefab, container);

            var picker = go.AddComponent<EnchantItemPicker>();
            picker.scrollItemId = scrollItemId;
            picker.window = go.GetComponent<GenericItemListV2>();
            picker.Build(state, scrollName);
        }

        private void Build(PlayerState state, string scrollName)
        {
            window.MoveToTop();
            window.CenterWindow();
            window.ToggleBox.gameObject.SetActive(false);
            window.InfoAreaText.gameObject.SetActive(false);
            window.TitleBar.text = $"เลือกของที่จะใช้ {scrollName}";
            window.OkButtonText.text = "จาร";
            window.OnPressCancel = Close;
            window.OnPressOk = Confirm;
            window.SetActive();

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
                window.TitleBar.text = "ไม่มีของที่ใส่ออพได้ในกระเป๋า";
        }

        /// <summary>Only things the server would accept: a unique weapon, armour or accessory.</summary>
        private static bool IsEnchantable(InventoryItem item)
        {
            if (!item.ItemData.IsUnique)
                return false;

            var itemClass = item.ItemData.ItemClass;
            return itemClass == ItemClass.Weapon || itemClass == ItemClass.Equipment;
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
