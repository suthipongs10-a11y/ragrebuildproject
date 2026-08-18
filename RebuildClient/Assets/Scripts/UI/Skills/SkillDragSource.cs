using RebuildSharedData.Enum;
using UnityEngine.EventSystems;

namespace Assets.Scripts.UI
{
    public class SkillDragSource : DragItemBase, IDragHandler, IBeginDragHandler, IEndDragHandler, IPointerClickHandler
    {
        public SkillWindowEntry Entry;
        private UiManager manager;

        public void Awake()
        {
            manager = UiManager.Instance;
        }
        
        public void OnBeginDrag(PointerEventData eventData)
        {
            manager.StartItemDrag(this);
        }

        public void OnEndDrag(PointerEventData eventData)
        {
            manager.EndItemDrag();
        }

        public void OnDrag(PointerEventData eventData)
        {
            // Debug.Log("HII");
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            //One tap puts the skill on the bar, on a screen where dragging it there is the
            //hard way round. The drag still works and is still the only way on a desktop;
            //this is the way that cannot miss, because the finger never has to travel from
            //the window it is in to a slot the window is usually covering.
            if (Mobile.MobileMode.IsActive && eventData.clickCount < 2)
            {
                Mobile.HotbarPickerWindow.PutOnBar(ItemId, ItemCount, Entry);
                return;
            }

            if (eventData.clickCount < 2 && eventData.clickCount % 2 != 0)
                return;
            if(CameraFollower.Instance.PressSkillButton((CharacterSkill)ItemId, ItemCount))
                Entry.HighlightSkillBox();
        }

    }
}