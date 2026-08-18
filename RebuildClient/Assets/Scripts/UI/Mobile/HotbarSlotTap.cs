using UnityEngine;
using UnityEngine.EventSystems;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// Opens the picker when an empty hotbar slot is tapped.
    ///
    /// A slot that holds something is fired by the draggable item sitting in it. An empty one
    /// has no draggable at all - it is switched off the moment the slot is cleared - so there
    /// is nothing there to click, and on a phone an empty slot was a square that did nothing
    /// whatever you did to it. This is the missing half.
    ///
    /// Added and removed by the phone layout rather than built into the slot, so a desktop
    /// slot behaves exactly as it always has.
    /// </summary>
    public class HotbarSlotTap : MonoBehaviour, IPointerClickHandler
    {
        public SkillHotbarEntry Entry;

        public void OnPointerClick(PointerEventData eventData)
        {
            if (Entry == null || Entry.DragItem == null)
                return;

            //a filled slot has already handled this click itself
            if (Entry.DragItem.Type != DragItemType.None)
                return;

            HotbarPickerWindow.Open(Entry.Id);
        }
    }
}
