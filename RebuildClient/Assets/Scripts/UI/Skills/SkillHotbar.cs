using System;
using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using Assets.Scripts.UI.ConfigWindow;
using RebuildSharedData.Enum;
using UnityEngine;
using UnityEngine.Serialization;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    public class SkillHotbar : WindowBase
    {
        public Transform SkillBarContainer;
        public GameObject SkillBarRowTemplate;
        public GameObject EntryPrefab;
        public string HotBarCharacterName;
        [FormerlySerializedAs("DragHandle")] public ResizeHandle ResizeHandle;

        private List<GameObject> HotBarRows = new();
        private List<SkillHotbarEntry> HotBarEntries = new();
        private UiManager manager;

        private bool isOpenForDrop;
        private bool isInitialized;
        private bool isTransparentState;

        private SkillHotbarEntry pressedEntry;

        public void ToggleTransparentState()
        {
            var img = GetComponent<Image>();
            isTransparentState = !isTransparentState;

            var color = isTransparentState ? new Color(1f, 1f, 1f, 1 / 255f) : Color.white; 
            
            img.color = color;
            foreach (var entry in HotBarEntries)
            {
                entry.GetComponent<Image>().color = color;
            }
        }
        
        public void UpdateDrag() //drag as in resize drag
        {
            // Debug.Log(ResizeHandle.CurrentStepSize);
            for (var i = 0; i < HotBarRows.Count; i++)
            {
                HotBarRows[i].SetActive(i <= ResizeHandle.CurrentStepSize.y);
            }
        }

        public SkillHotbarEntry GetEntryById(int id) => HotBarEntries[id];

        /// <summary>How many slots exist, so a caller can walk them without guessing.</summary>
        public int EntryCount => HotBarEntries.Count;

        private KeyCode[] HotKeyCode =
        {
            KeyCode.Alpha1, KeyCode.Alpha2, KeyCode.Alpha3, KeyCode.Alpha4, KeyCode.Alpha5, KeyCode.Alpha6, KeyCode.Alpha7, KeyCode.Alpha8, KeyCode.Alpha9, KeyCode.Alpha0,
            KeyCode.Alpha1, KeyCode.Alpha2, KeyCode.Alpha3, KeyCode.Alpha4, KeyCode.Alpha5, KeyCode.Alpha6, KeyCode.Alpha7, KeyCode.Alpha8, KeyCode.Alpha9, KeyCode.Alpha0,
            KeyCode.Alpha1, KeyCode.Alpha2, KeyCode.Alpha3, KeyCode.Alpha4, KeyCode.Alpha5, KeyCode.Alpha6, KeyCode.Alpha7, KeyCode.Alpha8, KeyCode.Alpha9, KeyCode.Alpha0,
        };

        private KeyCode[] ModifierKey =
        {
            KeyCode.None, KeyCode.None, KeyCode.None, KeyCode.None, KeyCode.None, KeyCode.None, KeyCode.None, KeyCode.None, KeyCode.None, KeyCode.None,
            KeyCode.LeftShift,KeyCode.LeftShift,KeyCode.LeftShift,KeyCode.LeftShift,KeyCode.LeftShift,KeyCode.LeftShift,KeyCode.LeftShift,KeyCode.LeftShift,KeyCode.LeftShift,KeyCode.LeftShift,
            KeyCode.LeftAlt,KeyCode.LeftAlt,KeyCode.LeftAlt,KeyCode.LeftAlt,KeyCode.LeftAlt,KeyCode.LeftAlt,KeyCode.LeftAlt,KeyCode.LeftAlt,KeyCode.LeftAlt,KeyCode.LeftAlt,
        };

        private string[] HotKeyText =
        {
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
            "Shift 1", "Shift 2", "Shift 3", "Shift 4", "Shift 5", "Shift 6", "Shift 7", "Shift 8", "Shift 9", "Shift 0",
            "Alt 1", "Alt 2", "Alt 3", "Alt 4", "Alt 5", "Alt 6", "Alt 7", "Alt 8", "Alt 9", "Alt 0",
        };

        private void SetUpEntry(SkillHotbarEntry entry, int id)
        {
            MakeSlotCatchThePointer(entry);
            entry.Id = id;
            entry.Parent = this;
            entry.enabled = false;
            entry.CanDrag = true;
            entry.UIManager = UiManager.Instance;
            entry.Clear();
            entry.HotkeyText.text = id < HotKeyText.Length ? HotKeyText[id] : "";
            entry.DragItem.Origin = ItemDragOrigin.HotBar;
            entry.DragItem.OriginId = id;
            entry.DragItem.OnDoubleClick = entry.OnDoubleClick;
        }

        private void SetupFirstDeleteMe(SkillHotbarEntry entry, int id)
        {
            entry.Id = id;
            entry.Parent = this;
            entry.enabled = true;
            entry.CanDrag = false;
            entry.UIManager = UiManager.Instance;
            //entry.Clear();
            entry.DragItem.ItemCount = 200;
            entry.HotkeyText.text = id < HotKeyText.Length ? HotKeyText[id] : "";
            entry.DragItem.CountText.text = entry.DragItem.ItemCount.ToString();
            entry.DragItem.Origin = ItemDragOrigin.HotBar;
            entry.DragItem.OriginId = id;
            entry.DragItem.OnDoubleClick = entry.OnDoubleClick;
        }

        /// <summary>
        /// Makes the whole slot answer the pointer, empty or not.
        ///
        /// A slot registers itself as somewhere an item can be dropped from OnPointerEnter,
        /// and that only arrives if something under the pointer is a raycast target. The only
        /// one a slot had was the draggable item in it - which is switched off the moment the
        /// slot is cleared. So a slot with something in it could be dropped on and an empty
        /// one could not, which is every slot on a new character: dragging a skill onto the
        /// bar did nothing at all, and there was nothing to see, because the highlight that
        /// says "here" is drawn by the same event that never arrived.
        ///
        /// The background is made to catch it instead. It is behind everything else in the
        /// slot, so this changes what the slot answers and nothing about how it looks.
        /// </summary>
        private static void MakeSlotCatchThePointer(SkillHotbarEntry entry)
        {
            var background = entry.GetComponent<Image>();
            if (background == null)
            {
                //no background to make catch it, so one is added behind the rest. Fully
                //transparent: a raycast target does not have to be visible.
                //An image added to the slot's own object already draws behind everything in
                //it, because children draw after their parent. Sending the transform to the
                //front would move the SLOT to the front of its row instead - this and the
                //background share one transform - and the row would come out back to front.
                background = entry.gameObject.AddComponent<Image>();
                background.color = new Color(1f, 1f, 1f, 0f);
            }

            background.raycastTarget = true;
        }

        public void UpdateItemCounts()
        {
            var state = PlayerState.Instance;
            var inventory = state.Inventory;

            for (var i = 0; i < HotBarEntries.Count; i++)
            {
                var entry = HotBarEntries[i].DragItem;
                if (entry.Type == DragItemType.Item)
                {
                    if (entry.ItemId >= 20000)
                    {
                        if(PlayerState.Instance.EquippedBagIdHashes.Contains(HotBarEntries[i].DragItem.ItemId))
                            entry.SetEquipped();
                        else
                            entry.HideCount();
                    }
                    else
                    {
                        entry.UpdateCount(inventory.GetItemCount(entry.ItemId));
                        if (state.AmmoId == entry.ItemId)
                            entry.BlueCount();
                    }
                }
            }
        }

        public void Initialize()
        {
            manager = UiManager.Instance;
            isInitialized = true;
            for (var i = 0; i < 3; i++)
            {
                var row = GameObject.Instantiate(SkillBarRowTemplate, SkillBarContainer);
                //SetupFirstDeleteMe(firstEntry, i * 10);
                //HotBarEntries.Add(firstEntry);
                for (var j = 0; j < 10; j++)
                {
                    var go = GameObject.Instantiate(EntryPrefab, row.transform);
                    var entry = go.GetComponent<SkillHotbarEntry>();
                    SetUpEntry(entry, i * 10 + j);
                    HotBarEntries.Add(entry);
                }

                if (i > 0)
                    row.SetActive(false);
                HotBarRows.Add(row);
            }

            Destroy(SkillBarRowTemplate);

            GameConfig.InitializeIfNecessary();
            // LoadHotBarData(GameConfig.Data.HotBarSaveData);
        }

        public void ActivateHotBarEntry(SkillHotbarEntry entry)
        {
            if (!PlayerState.Instance.IsValid)
                return;

            var state = PlayerState.Instance;

            if (entry.DragItem.Type == DragItemType.Skill)
            {
                var onCursor = CameraFollower.Instance.PressSkillButton((CharacterSkill)entry.DragItem.ItemId, entry.DragItem.ItemCount);
                if (onCursor && entry.gameObject.activeInHierarchy)
                {
                    if (pressedEntry != null)
                        pressedEntry.ReleaseSkill();
                    pressedEntry = entry;
                    entry.PressKey();
                }
            }

            if (entry.DragItem.Type == DragItemType.Item)
            {
                if (entry.DragItem.ItemCount <= 0)
                    return;
                if (!state.Inventory.GetInventoryData().TryGetValue(entry.DragItem.ItemId, out var item))
                    return;

                switch (item.ItemData.UseType)
                {
                    case ItemUseType.Use:
                        NetworkManager.Instance.SendUseItem(entry.DragItem.ItemId);
                        break;
                    case ItemUseType.UseOnAlly:
                        CameraFollower.Instance.BeginTargetingItem(item.Id, SkillTarget.Ally);
                        break;
                    case ItemUseType.UseOnEnemy:
                        CameraFollower.Instance.BeginTargetingItem(item.Id, SkillTarget.Enemy);
                        break;
                }

                if (item.ItemData.ItemClass == ItemClass.Weapon || item.ItemData.ItemClass == ItemClass.Equipment)
                    NetworkManager.Instance.SendEquipItem(entry.DragItem.ItemId);
                if (item.ItemData.ItemClass == ItemClass.Ammo && state.AmmoId != item.Id)
                    NetworkManager.Instance.SendEquipItem(entry.DragItem.ItemId);

                if (item.ItemData.UseType == ItemUseType.NotUsable)
                    return;

                //var cnt = entry.DragItem.ItemCount - 1;
                // if (cnt <= 0)
                //     entry.DragItem.Clear();
                // else
                //entry.DragItem.UpdateCount(cnt);
            }
        }

        public void UpdateHotkeyPresses()
        {
            if (!CameraFollower.Instance.HasSkillOnCursor && pressedEntry != null)
            {
                pressedEntry.ReleaseSkill();
                pressedEntry = null;
            }

            var hasShift = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            var hasControl = Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl);
            var hasAlt = Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt);
            for (var i = 0; i < HotKeyCode.Length; i++)
            {
                if (Input.GetKeyDown(HotKeyCode[i]))
                {
                    var mod = ModifierKey[i];
                    if (mod == KeyCode.LeftShift && hasShift && !hasControl && !hasAlt)
                        ActivateHotBarEntry(HotBarEntries[i]);
                    if (mod == KeyCode.LeftControl && hasControl && !hasShift && !hasAlt)
                        ActivateHotBarEntry(HotBarEntries[i]);
                    if (mod == KeyCode.LeftAlt && !hasControl && !hasShift && hasAlt)
                        ActivateHotBarEntry(HotBarEntries[i]);
                    if(mod == KeyCode.None && !hasShift && !hasControl && !hasAlt)
                        ActivateHotBarEntry(HotBarEntries[i]);
                }
            }
        }

        public HotBarSaveData[] SaveHotBarData(HotBarSaveData[] data)
        {
            if (data == null)
            {
                data = new HotBarSaveData[HotBarEntries.Count];
                for (var i = 0; i < data.Length; i++)
                    data[i] = new HotBarSaveData() { Type = DragItemType.None };
            }

            for (var i = 0; i < data.Length; i++)
            {
                if (data[i] == null)
                    data[i] = new HotBarSaveData() { Type = DragItemType.None };
                data[i].Type = HotBarEntries[i].DragItem.Type;
                data[i].ItemId = HotBarEntries[i].DragItem.ItemId;
                data[i].ItemCount = HotBarEntries[i].DragItem.ItemCount;
                if (data[i].ItemId >= 20000 && PlayerState.Instance.Inventory.TryGetInventoryItem(data[i].ItemId, out var equip))
                {
                    data[i].ItemId = equip.BagSlotId;
                    data[i].UniqueItem = equip.UniqueItem.UniqueId.ToByteArray();
                }
            }

            return data;
        }

        public void LoadHotBarData(string playerName)
        {
            if (HotBarCharacterName == playerName)
                return;

            var data = GameConfig.Data.GetHotBarDataForCharacter(playerName);

            if (data == null)
                return;

            var len = Mathf.Min(data.Length, HotBarEntries.Count);
            for (var i = 0; i < len; i++)
            {
                if (data[i] == null)
                {
                    data[i] = new HotBarSaveData() { Type = DragItemType.None };
                    continue;
                }

                if (data[i].Type == DragItemType.Skill)
                {
                    var skillData = ClientDataLoader.Instance.GetSkillData((CharacterSkill)data[i].ItemId);
                    var spriteName = ClientDataLoader.Instance.GetSkillData((CharacterSkill)data[i].ItemId).Icon;
                    var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(spriteName);
                    if (sprite != null)
                    {
                        HotBarEntries[i].DragItem.gameObject.SetActive(true);
                        HotBarEntries[i].DragItem.Assign(data[i].Type, sprite, data[i].ItemId, data[i].ItemCount);
                        if (skillData.AdjustableLevel == false)
                            HotBarEntries[i].DragItem.UpdateCount(0);
                    }
                }

                if (data[i].Type == DragItemType.Item)
                {
                    if (data[i].UniqueItem != null && data[i].UniqueItem.Length > 0)
                    {
                        try
                        {
                            var guid = new Guid(data[i].UniqueItem);
                            if (PlayerState.Instance.Inventory.UniqueItemIdToBagId.TryGetValue(guid, out var bagId) &&
                                PlayerState.Instance.Inventory.TryGetInventoryItem(bagId, out var inventoryItem))
                            {
                                var equipSprite = ClientDataLoader.Instance.GetIconAtlasSprite(inventoryItem.ItemData.Sprite);
                                HotBarEntries[i].DragItem.gameObject.SetActive(true);
                                HotBarEntries[i].DragItem.Assign(DragItemType.Item, equipSprite, bagId, 1);
                                HotBarEntries[i].DragItem.OriginId = i;
                                continue;
                            }
                        }
                        catch
                        {
                            continue; //if we can't parse the guid we just continue on our merry way
                        }
                    }

                    if (!ClientDataLoader.Instance.TryGetItemById(data[i].ItemId, out var item))
                        continue;

                    var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(item.Sprite);
                    if (sprite != null)
                    {
                        HotBarEntries[i].DragItem.gameObject.SetActive(true);
                        HotBarEntries[i].DragItem.Assign(data[i].Type, sprite, data[i].ItemId, 0);
                    }
                }
            }

            UpdateItemCounts();
        }

        public void Update()
        {
            if (!NetworkManager.IsLoaded || manager == null) return;
            if (manager.IsDraggingItem && !isOpenForDrop)
            {
                for (var i = 0; i < HotBarEntries.Count; i++)
                {
                    HotBarEntries[i].enabled = true; //enable the entries, they will report to the UI manager when being hovered
                    if (HotBarEntries[i].DragItem.Type == DragItemType.None)
                        HotBarEntries[i].HotkeyText.gameObject.SetActive(true);
                }

                isOpenForDrop = true;
            }

            if (!manager.IsDraggingItem && isOpenForDrop)
            {
                for (var i = 0; i < HotBarEntries.Count; i++)
                {
                    //HotBarEntries[i].HighlightImage.SetActive(false);
                    HotBarEntries[i].HotkeyText.gameObject.SetActive(false);
                    //HotBarEntries[i].enabled = false; //disable them
                }

                isOpenForDrop = false;
            }
        }
    }
}