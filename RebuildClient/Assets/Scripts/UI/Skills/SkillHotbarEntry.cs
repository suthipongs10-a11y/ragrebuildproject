using Assets.Scripts.Sprites;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    public class SkillHotbarEntry : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IItemDropTarget
    {
        public SkillHotbar Parent;
        public UiManager UIManager;
        public DraggableItem DragItem;
        public GameObject HighlightImage;
        public Image FlashImage;
        public TextMeshProUGUI HotkeyText;
        public int Id;
        public bool CanDrag = true;

        public void Awake()
        {
            HighlightImage.SetActive(false);

            //The slot number is the last child in the prefab, and a later sibling draws on
            //top, so it sat over whatever skill or item was in the slot. Dropped behind the
            //icon instead: an empty slot still shows its number because there is nothing in
            //front of it, and a filled one shows the thing you put there.
            if (HotkeyText != null && DragItem != null
                                   && HotkeyText.transform.parent == DragItem.transform.parent)
                HotkeyText.transform.SetSiblingIndex(DragItem.transform.GetSiblingIndex());
        }

        public void PressKey()
        {
            FlashImage.gameObject.SetActive(true);
        }

        public void OnDoubleClick()
        {
            if (DragItem.Type == DragItemType.None)
                return;
            Parent.ActivateHotBarEntry(this);
        }

        public void ReleaseSkill()
        {
            FlashImage.gameObject.SetActive(false);
        }
        
        public void OnPointerEnter(PointerEventData eventData)
        {
            if (!CanDrag)
                return;

            if (!IsValidItemType(UIManager.DragItemObject))
                return;
            
            HighlightImage.SetActive(true);
            
            if (UIManager.IsDraggingItem)
            {
                UIManager.RegisterDragTarget(this);
            }
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            if (!CanDrag)
                return;
            
            
            if (!IsValidItemType(UIManager.DragItemObject))
                return;
            
            HighlightImage.SetActive(false);
            
            if (UIManager.IsDraggingItem)
            {
                UIManager.UnregisterDragTarget(this);
            }
        }

        private bool IsValidItemType(ItemDragObject dragObject)
        {
            if (dragObject.Type == DragItemType.Item)
                return true;

            if (dragObject.Type != DragItemType.Skill)
                return false;

            //A passive has nothing to fire, so a slot holding one is a slot that does
            //nothing when it is pressed - Ore Discovery on the bar was exactly that. The
            //crafting skills are the exception: they are passive in the data and open the
            //forge when pressed, which is the whole reason they are allowed on a bar.
            var skill = (CharacterSkill)dragObject.ItemId;
            if (CraftingSkills.IsCraftingSkill(skill))
                return true;

            //GetSkillTarget rather than GetSkillData, which indexes and throws on a skill
            //the client's data does not have.
            if (ClientDataLoader.Instance == null)
                return true;

            return ClientDataLoader.Instance.GetSkillTarget(skill) != SkillTarget.Passive;
        }

        public void DropItem()
        {
            Debug.Log($"Dropped item into {name}");
            var dragObject = UIManager.DragItemObject;
            if (dragObject.Origin == ItemDragOrigin.HotBar)
            {
                if (!Input.GetKey(KeyCode.LeftShift) && !Input.GetKey(KeyCode.RightShift))
                {
                    var src = Parent.GetEntryById(dragObject.OriginId);
                    if (DragItem.Type == DragItemType.None)
                        src.DragItem.Clear();
                    else
                        src.DragItem.Assign(DragItem);
                }
            }

            if (IsValidItemType(dragObject))
            {
                DragItem.gameObject.SetActive(true);
                DragItem.Assign(dragObject);
            }

            HighlightImage.SetActive(false);
        }

        public void Clear()
        {
            if (!CanDrag)
                return;
            
            DragItem.Type = DragItemType.None;
            DragItem.gameObject.SetActive(false);
            HighlightImage.SetActive(false);
        }


    }
}