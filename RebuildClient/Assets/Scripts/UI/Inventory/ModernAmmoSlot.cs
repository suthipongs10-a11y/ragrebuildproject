using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Inventory
{
    /// <summary>
    /// A slot on the equipment page for arrows and other ammunition.
    ///
    /// The window this replaced had no slot for ammunition at all, only a line of text
    /// saying which kind was loaded, and the only way to load any was to know that
    /// double-clicking it in the bag worked. An archer who did not know that had no way
    /// to shoot, which is what happened.
    ///
    /// So it is a slot, and it takes ammunition three ways: drop a stack on it, click it
    /// while a stack is being dragged, or double-click the stack in the bag as before.
    /// Clicking it with nothing in hand takes the ammunition back off.
    /// </summary>
    public class ModernAmmoSlot : UIBehaviour, IPointerEnterHandler, IPointerExitHandler,
        IPointerClickHandler, IItemDropTarget
    {
        private static readonly Color32 HoverColor = new Color32(226, 203, 157, 255);
        private static readonly Color32 Clear = new Color32(0, 0, 0, 0);

        private const float RefreshInterval = 0.25f;

        public Image Highlight;
        public Image Icon;
        public TextMeshProUGUI Label;
        public TextMeshProUGUI Count;

        private int shownAmmo = -1;
        private int shownCount = -1;
        private float timer;

        public void OnPointerEnter(PointerEventData eventData)
        {
            if (UiManager.Instance == null || !UiManager.Instance.IsDraggingItem)
                return;

            UiManager.Instance.RegisterDragTarget(this);
            if (Highlight != null)
                Highlight.color = HoverColor;
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            if (UiManager.Instance == null || !UiManager.Instance.IsDraggingItem)
                return;

            UiManager.Instance.UnregisterDragTarget(this);
            DisableDropArea();
        }

        public void DisableDropArea()
        {
            if (Highlight != null)
                Highlight.color = Clear;
        }

        /// <summary>
        /// Called by the drag manager when a stack is let go over this slot.
        ///
        /// The dragged object's ItemId is the bag slot the stack came from rather than the
        /// kind of item it is — the same quirk the window's own drop zone works around —
        /// so what is being carried has to be looked up in the bag before it can be judged.
        /// </summary>
        public void DropItem()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.DragItemObject == null)
                return;

            var obj = ui.DragItemObject;
            if (obj.Origin != ItemDragOrigin.ItemWindow)
                return;

            if (!IsAmmoInBag(obj.ItemId))
                return;

            NetworkManager.Instance.SendEquipItem(obj.ItemId);
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            //a click that only happens to be the end of a drag would take back off what
            //the drag had just put on
            if (UiManager.Instance != null && UiManager.Instance.IsDraggingItem)
                return;

            var state = PlayerState.Instance;
            if (state == null || state.AmmoId <= 0)
                return;

            //the window's own unequip link passes the ammunition's item id rather than a
            //bag slot, and that is the path the server already handles
            NetworkManager.Instance.SendUnEquipItem(state.AmmoId);
        }

        private static bool IsAmmoInBag(int bagSlotId)
        {
            var state = PlayerState.Instance;
            if (state?.Inventory == null)
                return false;

            var bag = state.Inventory.GetInventoryData();
            if (bag == null || !bag.TryGetValue(bagSlotId, out var item) || item.ItemData == null)
                return false;

            return item.ItemData.ItemClass == ItemClass.Ammo;
        }

        private void Update()
        {
            timer -= Time.deltaTime;
            if (timer > 0)
                return;
            timer = RefreshInterval;

            var state = PlayerState.Instance;
            if (state == null)
                return;

            var ammo = state.AmmoId;
            var count = CountInBag(state, ammo);

            if (ammo == shownAmmo && count == shownCount)
                return;

            shownAmmo = ammo;
            shownCount = count;
            Redraw(ammo, count);
        }

        private static int CountInBag(PlayerState state, int ammoId)
        {
            if (ammoId <= 0 || state.Inventory == null)
                return 0;

            var bag = state.Inventory.GetInventoryData();
            if (bag == null)
                return 0;

            //ammunition stacks, so this is one entry rather than a sum, but summing costs
            //nothing and is right either way
            var total = 0;
            foreach (var entry in bag)
            {
                if (entry.Value.ItemData != null && entry.Value.ItemData.Id == ammoId)
                    total += entry.Value.Count;
            }

            return total;
        }

        private void Redraw(int ammoId, int count)
        {
            if (ammoId <= 0)
            {
                if (Icon != null)
                {
                    Icon.sprite = null;
                    Icon.color = Clear;
                }

                if (Label != null)
                {
                    Label.text = "ลากลูกธนูมาวางที่นี่";
                    Label.color = ModernUiTheme.MutedColor;
                }

                if (Count != null)
                    Count.text = "";

                return;
            }

            var data = ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetItemById(ammoId)
                : null;

            if (Icon != null)
            {
                var sprite = data != null ? ClientDataLoader.Instance.GetIconAtlasSprite(data.Sprite) : null;
                Icon.sprite = sprite;
                Icon.color = sprite != null ? Color.white : Clear;
            }

            if (Label != null)
            {
                Label.text = data != null ? data.Name : "?";
                Label.color = ModernUiTheme.NameColor;
            }

            if (Count != null)
                Count.text = count > 0 ? $"{count} ดอก" : "หมดแล้ว";
        }
    }
}
