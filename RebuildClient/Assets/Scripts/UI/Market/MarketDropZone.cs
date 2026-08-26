using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Market
{
    /// <summary>
    /// Lets a row of the market accept an item dragged out of the bag.
    ///
    /// The market window is built from code rather than from a prefab, so the drop zones
    /// that exist elsewhere in the client are no use here: they want an Image assigned in
    /// the inspector and they blank it on Awake, which on a row would paint over the row.
    /// This one is told which Image to tint and what colour it already is, and puts it back
    /// afterwards.
    ///
    /// Registering only happens while something is actually being dragged, so a row is an
    /// ordinary row the rest of the time and the drag that scrolls the list still scrolls it.
    /// </summary>
    public class MarketDropZone : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IItemDropTarget
    {
        public Image Highlight;
        public Color IdleColor = Color.white;
        public Color HoverColor = new Color(0.72f, 0.85f, 1f);

        /// <summary>Which windows an item may be dragged from into this row.</summary>
        public ItemDragOrigin ValidOrigins = ItemDragOrigin.ItemWindow | ItemDragOrigin.CartWindow;

        public Action<ItemDragObject> OnDropItem;

        private bool IsAcceptable
        {
            get
            {
                var ui = UiManager.Instance;
                if (ui == null || !ui.IsDraggingItem || ui.DragItemObject == null)
                    return false;

                return (ui.DragItemObject.Origin & ValidOrigins) != 0;
            }
        }

        public void OnPointerEnter(PointerEventData eventData)
        {
            if (!IsAcceptable)
                return;

            UiManager.Instance.RegisterDragTarget(this);
            if (Highlight != null)
                Highlight.color = HoverColor;
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            var ui = UiManager.Instance;
            if (ui != null && ui.IsDraggingItem)
                ui.UnregisterDragTarget(this);

            DisableDropArea();
        }

        public void DisableDropArea()
        {
            if (Highlight != null)
                Highlight.color = IdleColor;
        }

        public void DropItem()
        {
            var obj = UiManager.Instance != null ? UiManager.Instance.DragItemObject : null;
            DisableDropArea();

            if (obj == null || (obj.Origin & ValidOrigins) == 0)
                return;

            OnDropItem?.Invoke(obj);
        }
    }
}
