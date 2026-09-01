using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using UnityEngine;

namespace Assets.Scripts.UI.EnchantItem
{
    /// <summary>
    /// The cards in the bag, and a button that turns one stack of them into dust.
    /// </summary>
    /// <remarks>
    /// Same prefab and the same shape as the scroll's item picker, because it is the same
    /// question asked twice: which of the things you are carrying did you mean. Boss cards
    /// are listed and refused rather than hidden - a card missing from the list reads as a
    /// bug, a card that says why it cannot be ground reads as a rule.
    /// </remarks>
    public class CardGrindWindow : MonoBehaviour
    {
        public static CardGrindWindow Instance;

        private GenericItemListV2 window;
        private readonly Dictionary<int, int> itemIdByEntry = new Dictionary<int, int>();
        private readonly Dictionary<int, int> countByEntry = new Dictionary<int, int>();
        private readonly Dictionary<int, ItemListEntryV2> rowByEntry = new Dictionary<int, ItemListEntryV2>();
        private ItemListEntryV2 selected;
        private int selectedEntry = -1;

        public static void Open()
        {
            var state = PlayerState.Instance;
            if (state?.Inventory == null)
                return;

            if (Instance != null && Instance.window != null)
            {
                Instance.window.ShowWindow();
                Instance.window.SetActive();
                Instance.window.MoveToTop();
                return;
            }

            var go = Instantiate(UiManager.Instance.GenericItemListV2Prefab, UiManager.Instance.PrimaryUserWindowContainer);
            var grinder = go.AddComponent<CardGrindWindow>();
            grinder.window = go.GetComponent<GenericItemListV2>();
            Instance = grinder;

            grinder.Build(state);
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        private void Build(PlayerState state)
        {
            window.MoveToTop();
            window.CenterWindow();
            window.ToggleBox.gameObject.SetActive(false);
            window.TitleBar.text = "บดการ์ดเป็นผงการ์ด";
            window.OkButtonText.text = "บด";
            window.CancelButtonText.text = "ปิด";
            window.OnPressCancel = Close;
            window.OnPressOk = Confirm;
            window.OnCloseWindow = Close;
            window.SetActive();
            ShowHint("เลือกการ์ดหนึ่งกอง แล้วกด บด — ได้ผงการ์ดเท่าจำนวนใบ");

            var entryId = 0;

            foreach (var (_, item) in state.Inventory.GetInventoryData())
            {
                if (item.ItemData.ItemClass != ItemClass.Card)
                    continue;

                var entry = window.GetNewEntry();
                entry.Assign(DragItemType.None, ClientDataLoader.Instance.GetIconAtlasSprite(item.ItemData.Sprite),
                    item.BagSlotId, item.Count);

                entry.ItemName.text = item.ProperName();
                entry.ItemName.rectTransform.anchorMax = new Vector2(1, 1);
                entry.RightText.text = $"<size=-3><color=#7A7480>x{item.Count}</color></size>";

                entry.CanDrag = false;
                entry.CanSelect = true;
                entry.UniqueEntryId = entryId;
                entry.EventOnSelect = Select;
                entry.EventDoubleClick = Select;

                itemIdByEntry[entryId] = item.ItemData.Id;
                countByEntry[entryId] = item.Count;
                rowByEntry[entryId] = entry;
                entryId++;
            }

            if (entryId == 0)
                window.TitleBar.text = "ไม่มีการ์ดในกระเป๋า";
        }

        private void Select(int entryId)
        {
            if (!rowByEntry.TryGetValue(entryId, out var row))
                return;

            if (selected != null && selected != row)
                selected.Unselect();

            selected = row;
            selectedEntry = entryId;

            //The prefab ships its ok button switched off; this is where it comes on.
            window.OkButton.interactable = true;

            var count = countByEntry.TryGetValue(entryId, out var c) ? c : 0;
            ShowHint($"จะบด <color=#CC5500>{row.ItemName.text}</color> ทั้ง {count} ใบ — ได้ผงการ์ด {count}");
        }

        private void Confirm()
        {
            if (selectedEntry < 0)
            {
                ShowHint("<color=#CC0000>เลือกการ์ดก่อน</color> แล้วค่อยกด บด");
                window.SetActive();
                return;
            }

            if (!itemIdByEntry.TryGetValue(selectedEntry, out var itemId))
                return;

            var count = countByEntry.TryGetValue(selectedEntry, out var c) ? c : 1;

            NetworkManager.Instance.SendGrindCard(itemId, count);
            Close();
        }

        private void ShowHint(string text)
        {
            if (window.InfoAreaText == null)
                return;

            window.InfoAreaText.gameObject.SetActive(true);
            window.InfoAreaText.text = text;
        }

        private void Close()
        {
            if (window != null)
                Destroy(window.gameObject);
        }
    }
}
