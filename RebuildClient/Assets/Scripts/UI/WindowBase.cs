using Assets.Scripts.Utility;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Assets.Scripts.UI
{
    public class WindowBase : MonoBehaviour, IClosableWindow, IPointerDownHandler
    {
        public bool CanCloseWithEscape = true;
        public bool AutomaticallyFitIntoPlayArea = true;

        public void OnDestroy()
        {
            UiManager.Instance.WindowStack.Remove(this);
        }

        public virtual void CloseWindow()
        {
            HideWindow();
        }

        public bool CanCloseWindow()
        {
            return CanCloseWithEscape;
        }

        public virtual void OnPointerDown(PointerEventData eventData)
        {
            MoveToTop();
        }

        protected bool IsPointerOverUIObject()
        {
            return RectTransformUtility.RectangleContainsScreenPoint(transform.RectTransform(), Input.mousePosition);
        }

        public virtual void MoveToTop()
        {
            // Debug.Log($"MoveToTop {name}");
            transform.SetAsLastSibling(); //move to top
            UiManager.Instance.MoveToLast(this);
        }

        /// <summary>How small a window may be shrunk before it is left alone.</summary>
        private const float MinFitScale = 0.4f;

        /// <summary>
        /// The scale this window was built at, so shrinking it is undone when there is room
        /// again. Without it a phone turned sideways, or a browser window dragged wider,
        /// would keep whatever size the narrowest moment of the session decided on.
        /// </summary>
        private Vector3 fitBaseScale;
        private bool hasFitBaseScale;

        /// <summary>
        /// Brings a window back inside the screen, shrinking it first if it cannot fit.
        /// </summary>
        /// <remarks>
        /// Measured off the window's own corners rather than worked out from sizeDelta and
        /// a guess at where the pivot is. The arithmetic this replaces assumed one pivot
        /// for the horizontal edge and another for the vertical, so it was only ever right
        /// for windows that happened to be built that way.
        ///
        /// The rest is what a phone needs. A window laid out for a monitor can be taller
        /// than a handset screen, and it cannot be dragged into view because there is
        /// nowhere for it to go - the storage chest arrived with its title bar, and so its
        /// close button, above the top of the screen and no way to reach either. So an
        /// oversized window is scaled down until it fits, and where it still does not, the
        /// top edge wins: the bottom of a list can be scrolled to, a close button that is
        /// off the screen cannot be got at by any means at all.
        ///
        /// Only ever shrinks. On a monitor everything already fits and this does nothing.
        /// </remarks>
        public void FitWindowIntoPlayArea()
        {
            if (!AutomaticallyFitIntoPlayArea)
                return;

            var rect = GetComponent<RectTransform>();
            if (rect == null || Screen.width < 1 || Screen.height < 1)
                return;

            if (!hasFitBaseScale)
            {
                fitBaseScale = transform.localScale;
                hasFitBaseScale = true;
            }

            //Measured at the size it was built at every time, rather than at whatever this
            //left it at last time. Otherwise each pass shrinks what the pass before shrank
            //and the window walks away to nothing.
            transform.localScale = fitBaseScale;

            var corners = new Vector3[4];
            rect.GetWorldCorners(corners); //0 bottom left, 1 top left, 2 top right, 3 bottom right

            var width = corners[2].x - corners[0].x;
            var height = corners[1].y - corners[0].y;
            if (width < 1f || height < 1f)
                return; //not laid out yet

            var fit = Mathf.Min(Screen.width / width, Screen.height / height, 1f);
            if (fit < 1f)
            {
                transform.localScale = fitBaseScale * Mathf.Max(fit, MinFitScale);

                //the corners moved, so they have to be asked again before anything is
                //placed against them
                rect.GetWorldCorners(corners);
            }

            var shift = Vector3.zero;

            if (corners[0].x < 0f)
                shift.x = -corners[0].x;
            else if (corners[2].x > Screen.width)
                shift.x = Screen.width - corners[2].x;

            //top first and on its own where the window is still too tall, because that edge
            //carries the title bar and the close button with it
            if (corners[1].y > Screen.height)
                shift.y = Screen.height - corners[1].y;
            else if (corners[0].y < 0f)
                shift.y = Mathf.Min(-corners[0].y, Screen.height - corners[1].y);

            if (shift != Vector3.zero)
                transform.position += shift;
        }

        public void ToggleVisibility()
        {
            if (UiManager.Instance.IsDraggingItem)
                UiManager.Instance.EndItemDrag(false);
            
            if (gameObject.activeInHierarchy)
                HideWindow();
            else
                ShowWindow();
        }

        public virtual void ShowWindow()
        {
            if (gameObject == null)
                return;
            gameObject.SetActive(true);
            var mgr = UiManager.Instance;
            if (!mgr.WindowStack.Contains(this))
                mgr.WindowStack.Add(this);

            FitWindowIntoPlayArea();
            transform.SetAsLastSibling(); //move to top

            ((RectTransform)transform).ForceUpdateRectTransforms();

            //Init();
        }

        public virtual void HideWindow()
        {
            if (gameObject == null)
                return;
            gameObject.SetActive(false);
            var mgr = UiManager.Instance;
            if (mgr.WindowStack.Contains(this))
            {
                mgr.WindowStack.Remove(this);
                mgr.ForceHideTooltip();
            }

            if (mgr.IsDraggingItem) mgr.EndItemDrag(false);

            // Debug.Log(name + " : " + gameObject.activeInHierarchy);
        }

        public void CenterWindow(int setHeight = 0)
        {
            //center window
            ((RectTransform)transform).ForceUpdateRectTransforms();
            var rect = gameObject.GetComponent<RectTransform>();
            if (setHeight > 0)
                rect.sizeDelta = new Vector2(rect.sizeDelta.x, setHeight);
            var parentContainer = (RectTransform)gameObject.transform.parent;
            var middle = parentContainer.rect.size / 2f;
            middle = new Vector2(middle.x, -middle.y);
            rect.anchoredPosition = middle - new Vector2(rect.sizeDelta.x / 2, -rect.sizeDelta.y / 2);
        }

        public void CenterWindow(Vector2 center)
        {
            //center window
            ((RectTransform)transform).ForceUpdateRectTransforms();
            var rect = gameObject.GetComponent<RectTransform>();
            var parentContainer = (RectTransform)gameObject.transform.parent;
            var middle = parentContainer.rect.size * center;
            middle = new Vector2(middle.x, -middle.y);
            rect.anchoredPosition = middle - new Vector2(rect.sizeDelta.x / 2, -rect.sizeDelta.y / 2);
        }
        
        
        public void CenterWindowWithOffset(Vector2 offset)
        {
            //center window
            ((RectTransform)transform).ForceUpdateRectTransforms();
            var rect = gameObject.GetComponent<RectTransform>();
            var parentContainer = (RectTransform)gameObject.transform.parent;
            var middle = parentContainer.rect.size / 2f;
            middle = new Vector2(middle.x, -middle.y);
            rect.anchoredPosition = middle - new Vector2(offset.x, -offset.y);
        }


        protected void AttachToMainUI()
        {
            transform.SetParent(UiManager.Instance.PrimaryUserWindowContainer);
            transform.localScale = Vector3.one;
        }
    }
}