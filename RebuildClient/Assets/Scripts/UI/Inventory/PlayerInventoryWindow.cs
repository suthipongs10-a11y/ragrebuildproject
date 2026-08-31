using System.Collections.Generic;
using System.Linq;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.UI.EnchantItem;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Inventory
{
    public class PlayerInventoryWindow : WindowBase
    {
        public Button[] UiTabButtons;
        public GameObject[] UiButtonGroups;
        public Vector2 UnitSize;
        public RectTransform ItemBoxRoot;
        public RectTransform ViewBoxTransform;
        public GameObject ItemEntryPrefab;
        public ScrollRect ScrollArea;
        private List<InventoryEntry> entryList = new();
        public TextMeshProUGUI WeightText;
        //filled in by the skin when it splits the one readout into a count line and a
        //weight line with a bar; left null the window writes the single line it always did
        public TextMeshProUGUI CountText;
        public Image WeightFill;
        public Button CartButton;
        private int activeEntryCount;
        private int activeItemSection;
        private bool isInit;
        
        

        public void Awake()
        {
            if (ItemBoxRoot.childCount != 0)
                Destroy(ItemBoxRoot.transform.GetChild(0).gameObject);
        }

        public override void ShowWindow()
        {
            base.ShowWindow();
            UpdateActiveVisibleBag();
            CartButton.gameObject.SetActive(PlayerState.Instance.HasCart);
        }

        public void ToggleCart()
        {
            if(PlayerState.Instance.HasCart)
                UiManager.Instance.CartWindow.ShowWindow();
        }
        
        public void ClickTabButton(int tab)
        {
            switch (tab)
            {
                case 0:
                    UiButtonGroups[1].transform.SetAsLastSibling();
                    UiButtonGroups[2].transform.SetAsLastSibling();
                    UiButtonGroups[0].transform.SetAsLastSibling();
                    break;
                case 1:
                    UiButtonGroups[0].transform.SetAsLastSibling();
                    UiButtonGroups[2].transform.SetAsLastSibling();
                    UiButtonGroups[1].transform.SetAsLastSibling();
                    break;
                case 2:
                    UiButtonGroups[0].transform.SetAsLastSibling();
                    UiButtonGroups[1].transform.SetAsLastSibling();
                    UiButtonGroups[2].transform.SetAsLastSibling();
                    break;
            }

            UiTabButtons[0].transform.localPosition = new Vector3(tab == 0 ? -30 : -24, UiTabButtons[0].transform.localPosition.y, 0);
            UiTabButtons[1].transform.localPosition = new Vector3(tab == 1 ? -30 : -24, UiTabButtons[1].transform.localPosition.y, 0);
            UiTabButtons[2].transform.localPosition = new Vector3(tab == 2 ? -30 : -24, UiTabButtons[2].transform.localPosition.y, 0);
            UiTabButtons[0].interactable = tab != 0;
            UiTabButtons[1].interactable = tab != 1;
            UiTabButtons[2].interactable = tab != 2;
            activeItemSection = tab;

            UpdateActiveVisibleBag();
        }

        private void OnRightClick(InventoryItem item)
        {
            if (PlayerState.Instance.HasCart && (Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt)))
            {
                UiManager.Instance.CartWindow.OnMoveInventoryItemToCart(item.BagSlotId);
                return;
            }

            UiManager.Instance.ItemDescriptionWindow.ShowItemDescription(item);
        }

        private void OnDoubleClick(InventoryEntry itemEntry, InventoryItem item)
        {
            var state = PlayerState.Instance;

            if (StorageUI.Instance != null)
            {
                StorageUI.Instance.OnMoveInventoryItemToStorage(item.BagSlotId);
                return;
            }
            //
            // if (UiManager.Instance.CartWindow.gameObject.activeInHierarchy && (Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt)))
            // {
            //     UiManager.Instance.CartWindow.OnMoveInventoryItemToCart(itemEntry.DragItem.OriginId);
            //     return;
            // }

            switch (item.ItemData.UseType)
            {
                case ItemUseType.Use:
                    NetworkManager.Instance.SendUseItem(item.BagSlotId);
                    break;
                case ItemUseType.UseOnAlly:
                    CameraFollower.Instance.BeginTargetingItem(item.Id, SkillTarget.Ally);
                    break;
                case ItemUseType.UseOnEnemy:
                    CameraFollower.Instance.BeginTargetingItem(item.Id, SkillTarget.Enemy);
                    break;
                case ItemUseType.UseOnItem:
                    //The target is another item rather than a character, so the picker opens
                    //here and nothing goes to the server until something is chosen.
                    EnchantItemPicker.Open(item.BagSlotId, item.ItemData.Name);
                    break;
                default:
                {
                    var itemClass = item.ItemData.ItemClass;
                    if (itemClass == ItemClass.Weapon || itemClass == ItemClass.Equipment || itemClass == ItemClass.Ammo)
                    {
                        if (!state.EquippedItems.Contains(item.BagSlotId))
                        {
                            if (itemClass == ItemClass.Ammo)
                            {
                                if (state.AmmoId == item.Id)
                                    itemEntry.DragItem.BlueCount();
                            }
                            else
                                itemEntry.DragItem.HideCount();

                            NetworkManager.Instance.SendEquipItem(item.BagSlotId);
                        }
                    }
                    else if (itemClass == ItemClass.Card)
                        CardSocketWindow.BeginCardSocketing(item);

                    break;
                }
            }
        }
        
        public void UpdateActiveVisibleBag()
        {
            if (!gameObject.activeSelf || PlayerState.Instance == null)
                return;

            var state = PlayerState.Instance;
            var inventory = state.Inventory;
            activeEntryCount = 0;
            var bagItems = inventory.GetInventoryData();
            var curWeight = state.CurrentWeight / 10;
            var totalWeight = state.MaxWeight / 10;

            var weightPercent = curWeight * 100 / totalWeight;
            var countText = bagItems.Count < 190 ? $"{bagItems.Count}/200" : $"<color=red>{bagItems.Count}</color>/200";
            var percentText = weightPercent < 90 ? $"{weightPercent}%" : $"<color=red>{weightPercent}%</color>";
            
            if (CountText != null)
            {
                CountText.text = $"{countText} ไอเทม";
                WeightText.text = $"น้ำหนัก {curWeight} / {totalWeight} ({percentText})";
            }
            else
                WeightText.text = $"ไอเทม {countText}     น้ำหนัก {curWeight}/{totalWeight} ({percentText})";

            if (WeightFill != null)
                WeightFill.fillAmount = Mathf.Clamp01(weightPercent / 100f);
            
            foreach (var bagEntry in bagItems)
            {
                var item = bagEntry.Value;
                if (activeItemSection == 0 && (item.ItemData.IsUnique || item.ItemData.UseType == ItemUseType.NotUsable)) continue;
                if (activeItemSection == 1 && (!item.ItemData.IsUnique || item.ItemData.Id < 0)) continue;
                if (activeItemSection == 2 && (item.ItemData.IsUnique || item.ItemData.UseType != ItemUseType.NotUsable) && item.ItemData.Id > 0) continue;

                //worn gear belongs to the equipment window, not the bag. Ammo is the
                //exception, its stack stays visible here so you can watch it deplete.
                if (state.EquippedItems.Contains(item.BagSlotId) && item.ItemData.ItemClass != ItemClass.Ammo)
                    continue;

                if (entryList.Count <= activeEntryCount)
                {
                    var newEntry = GameObject.Instantiate(ItemEntryPrefab, ItemBoxRoot, false);
                    var drag = newEntry.GetComponent<InventoryEntry>();
                    entryList.Add(drag);
                }

                var itemEntry = entryList[activeEntryCount];
                var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(item.ItemData.Sprite);
                if (sprite == null)
                {
                    Debug.LogWarning($"Failed to load sprite {item.ItemData.Sprite} for item {item.ItemData.Name}");
                    sprite = ClientDataLoader.Instance.GetIconAtlasSprite("Apple");
                }

                itemEntry.DragItem.Assign(DragItemType.Item, sprite, bagEntry.Key, item.Count);
                itemEntry.DragItem.OriginId = bagEntry.Key;
                itemEntry.gameObject.SetActive(true);
                itemEntry.DragItem.gameObject.SetActive(true);
                itemEntry.DragItem.OnRightClick = () => OnRightClick(item);
                if (state.EquippedItems.Contains(item.BagSlotId))
                {
                    //only equipped ammo reaches here, tint its count to mark it as worn
                    itemEntry.DragItem.BlueCount();
                    itemEntry.DragItem.OnDoubleClick = null;
                }
                else
                    itemEntry.DragItem.OnDoubleClick = () => OnDoubleClick(itemEntry, item);

                activeEntryCount++;
            }
            
            var left = ItemBoxRoot.anchoredPosition;
            var entriesPerRow = (int)((ViewBoxTransform.rect.width - 40 + 5 - left.x) / UnitSize.x); //the 5 is cause there's no spacing after the last item in a row
            var requiredRows = Mathf.CeilToInt((float)activeEntryCount / entriesPerRow);
            var requiredBoxes = entriesPerRow * requiredRows;

            var minRows = (int)((ViewBoxTransform.rect.height - 8) / UnitSize.y);
            var minBoxes = entriesPerRow * minRows;
            var totalBoxes = Mathf.Max(requiredBoxes, minBoxes);
            
            // Debug.Log($"TotalBoxes: {totalBoxes} EntryList.Count: {entryList.Count} ActiveEntryCount: {activeEntryCount}");

            while (totalBoxes > entryList.Count)
            {
                var newEntry = GameObject.Instantiate(ItemEntryPrefab, ItemBoxRoot, false);
                var drag = newEntry.GetComponent<InventoryEntry>();
                entryList.Add(drag);
            }
            
            // Debug.Log($"EntriesPerRow:{entriesPerRow} RequiredRows:{requiredRows} RequiredBoxes:{requiredBoxes} MinBoxes:{minBoxes} MinRows: {minRows} Rect:{ViewBoxTransform.rect}");

            for (var i = activeEntryCount; i < entryList.Count; i++)
            {
                entryList[i].DragItem.Clear();
                entryList[i].gameObject.SetActive(i < totalBoxes);
            }
        }
    }
}