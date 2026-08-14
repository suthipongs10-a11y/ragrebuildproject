using System;
using TMPro;
using UnityEngine.EventSystems;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// The shared look for the reskinned windows: a white rounded panel, light gray
    /// cards, dark text and small gray labels. Every skin pulls its colors, fonts and
    /// building blocks from here so the windows read as one family.
    /// Kept in sync with ModernEquipSkin, which predates this file.
    /// </summary>
    public static class ModernUiTheme
    {
        //a soft blue set: the window is a tinted off white, cards step down in two
        //stages and the header is the most saturated tone so it reads as a header
        public static readonly Color WindowColor = new Color(0.960f, 0.975f, 0.992f, 0.98f);
        public static readonly Color CardColor = new Color(0.898f, 0.933f, 0.976f);
        public static readonly Color CardDeepColor = new Color(0.843f, 0.894f, 0.957f);
        public static readonly Color TitleBarColor = new Color(0.741f, 0.843f, 0.941f);
        public static readonly Color TitleColor = new Color(0.098f, 0.192f, 0.310f);
        public static readonly Color LabelColor = new Color(0.416f, 0.510f, 0.616f);
        public static readonly Color NameColor = new Color(0.129f, 0.204f, 0.302f);
        public static readonly Color MutedColor = new Color(0.639f, 0.714f, 0.796f);
        public static readonly Color HintColor = new Color(0.427f, 0.522f, 0.620f);
        public static readonly Color AccentColor = new Color(0.263f, 0.545f, 0.878f);
        public static readonly Color AccentTextColor = Color.white;
        public static readonly Color PositiveColor = new Color(0.145f, 0.573f, 0.392f);

        public const float TitleBarHeight = 52f;

        private static bool? runtimeUiEnabled;

        /// <summary>
        /// Everything this project adds at runtime, the window skins and the touch
        /// controls, can be switched off by putting ?vanillaui=1 in the page address.
        /// A WebGL build takes long enough that being able to tell a fault in this code
        /// apart from one in the game itself without rebuilding is worth the flag.
        /// </summary>
        public static bool RuntimeUiEnabled
        {
            get
            {
                if (runtimeUiEnabled == null)
                {
                    var url = Application.absoluteURL ?? "";
                    runtimeUiEnabled = url.IndexOf("vanillaui=1", StringComparison.OrdinalIgnoreCase) < 0;
                    if (!runtimeUiEnabled.Value)
                        Debug.Log("[ModernUi] Runtime interface disabled by the vanillaui flag.");
                }

                return runtimeUiEnabled.Value;
            }
        }

        private static Sprite roundedSprite;

        public static Sprite RoundedSprite
        {
            get
            {
                if (roundedSprite == null)
                    roundedSprite = CreateRoundedSprite();
                return roundedSprite;
            }
        }

        /// <summary>
        /// Turns an existing window's own backdrop white and restyles its drag bar
        /// while keeping the bar (and so moving and closing) fully functional.
        /// Returns the drag bar so callers can skip it when hiding old content.
        /// </summary>
        public static Transform ApplyWindowChrome(Component window)
        {
            var root = (RectTransform)window.transform;

            var rootImage = window.GetComponent<Image>();
            if (rootImage != null)
            {
                rootImage.sprite = RoundedSprite;
                rootImage.type = Image.Type.Sliced;
                rootImage.color = WindowColor;
            }

            Transform dragBar = null;
            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                if (!child.name.ToLowerInvariant().Contains("drag"))
                    continue;

                dragBar = child;
                var barImage = child.GetComponent<Image>();
                if (barImage != null)
                {
                    barImage.sprite = RoundedSprite;
                    barImage.type = Image.Type.Sliced;
                    barImage.color = TitleBarColor;
                }

                foreach (var barText in child.GetComponentsInChildren<TextMeshProUGUI>(true))
                {
                    barText.color = TitleColor;
                    barText.fontStyle = FontStyles.Bold;
                }

                foreach (var barButton in child.GetComponentsInChildren<Button>(true))
                {
                    var buttonImage = barButton.GetComponent<Image>();
                    if (buttonImage != null)
                        buttonImage.color = HintColor;
                }
            }

            return dragBar;
        }

        /// <summary>
        /// Recolors every near-white or near-black text under the root to the theme's
        /// dark ink so light-on-dark leftovers stay readable on the new white panels.
        /// Colored text (greens, reds, blues) is left alone.
        /// </summary>
        public static void RecolorLightTexts(Transform root)
        {
            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                var c = text.color;
                var max = Mathf.Max(c.r, Mathf.Max(c.g, c.b));
                var min = Mathf.Min(c.r, Mathf.Min(c.g, c.b));
                var isGray = max - min < 0.15f;
                if (isGray && max > 0.7f)
                    text.color = NameColor;
            }
        }

        /// <summary>
        /// Builds a header across the top of a rebuilt window: a tinted bar carrying the
        /// window name and a close button, and doubling as the drag handle. Rebuilt
        /// windows hide their original chrome, so without this they have no way to be
        /// moved or closed at all.
        /// </summary>
        public static RectTransform CreateTitleBar(WindowBase window, string title)
        {
            var root = (RectTransform)window.transform;

            //assembled while inactive so the drag handle can be pointed at its window
            //before anything starts listening for pointers on it
            var barObject = new GameObject("ModernTitleBar", typeof(Image));
            barObject.SetActive(false);
            barObject.transform.SetParent(root, false);

            var image = barObject.GetComponent<Image>();
            image.sprite = RoundedSprite;
            image.type = Image.Type.Sliced;
            image.color = TitleBarColor;
            image.raycastTarget = true;

            var bar = (RectTransform)barObject.transform;
            bar.anchorMin = new Vector2(0, 1);
            bar.anchorMax = new Vector2(1, 1);
            bar.pivot = new Vector2(0.5f, 1);
            bar.offsetMin = new Vector2(0, -TitleBarHeight);
            bar.offsetMax = Vector2.zero;

            var handle = barObject.AddComponent<WindowDragHandle>();
            handle.Target = root;
            handle.Window = window;

            var label = CreateText(bar, "Title", title, 18, TitleColor, TextAlignmentOptions.Left, FontStyles.Bold);
            Stretch((RectTransform)label.transform, 18, 0, -60, 0);

            var close = CreateButton(bar, "Close", "X", CardColor, TitleColor, 16);
            Place((RectTransform)close.transform, new Vector2(1, 0.5f), new Vector2(-10, 0), new Vector2(34, 34));
            ((RectTransform)close.transform).pivot = new Vector2(1, 0.5f);
            close.onClick.AddListener(window.CloseWindow);

            barObject.SetActive(true);
            return bar;
        }

        /// <summary>
        /// Drags a window by its header. Written here rather than reusing the project's
        /// Draggable because that one reads its target during Awake, which a component
        /// added from code cannot satisfy in time.
        /// </summary>
        private class WindowDragHandle : MonoBehaviour, IPointerDownHandler, IDragHandler
        {
            public RectTransform Target;
            public WindowBase Window;

            private Vector2 grabOffset;

            public void OnPointerDown(PointerEventData eventData)
            {
                if (Window != null)
                    Window.MoveToTop();

                if (TryGetLocalPoint(eventData, out var local))
                    grabOffset = Target.anchoredPosition - local;
            }

            public void OnDrag(PointerEventData eventData)
            {
                if (Target != null && TryGetLocalPoint(eventData, out var local))
                    Target.anchoredPosition = local + grabOffset;
            }

            private bool TryGetLocalPoint(PointerEventData eventData, out Vector2 local)
            {
                local = Vector2.zero;
                var parent = Target != null ? Target.parent as RectTransform : null;
                if (parent == null)
                    return false;

                return RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    parent, eventData.position, eventData.pressEventCamera, out local);
            }
        }

        public static RectTransform CreateRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        public static RectTransform CreateCard(Transform parent, string name, Color color)
        {
            var go = new GameObject(name, typeof(Image));
            go.transform.SetParent(parent, false);
            var image = go.GetComponent<Image>();
            image.sprite = RoundedSprite;
            image.type = Image.Type.Sliced;
            image.color = color;
            return (RectTransform)go.transform;
        }

        public static TextMeshProUGUI CreateText(Transform parent, string name, string content, float size,
            Color color, TextAlignmentOptions alignment, FontStyles style = FontStyles.Normal)
        {
            var go = new GameObject(name, typeof(TextMeshProUGUI));
            go.transform.SetParent(parent, false);

            var text = go.GetComponent<TextMeshProUGUI>();
            if (TMP_Settings.defaultFontAsset != null)
                text.font = TMP_Settings.defaultFontAsset;
            text.text = content;
            text.fontSize = size;
            text.color = color;
            text.alignment = alignment;
            text.fontStyle = style;
            text.raycastTarget = false;
            return text;
        }

        public static void Place(RectTransform rect, Vector2 corner, Vector2 position, Vector2 size)
        {
            rect.anchorMin = corner;
            rect.anchorMax = corner;
            rect.pivot = corner;
            rect.sizeDelta = size;
            rect.anchoredPosition = position;
        }

        public static void Stretch(RectTransform rect, float left, float bottom, float right, float top)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(left, bottom);
            rect.offsetMax = new Vector2(right, top);
        }

        public static Button CreateButton(Transform parent, string name, string label, Color background,
            Color textColor, float fontSize = 14, FontStyles style = FontStyles.Bold)
        {
            var card = CreateCard(parent, name, background);
            var go = card.gameObject;
            go.GetComponent<Image>().raycastTarget = true;
            var button = go.AddComponent<Button>();
            button.targetGraphic = go.GetComponent<Image>();

            var text = CreateText(card, "Label", label, fontSize, textColor, TextAlignmentOptions.Center, style);
            Stretch((RectTransform)text.transform, 2, 2, -2, -2);
            return button;
        }

        private static Sprite CreateRoundedSprite()
        {
            const int size = 32;
            const int radius = 10;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);

            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    var inside = true;
                    if (x < radius && y < radius)
                        inside = InCorner(x, y, radius, radius, radius);
                    else if (x >= size - radius && y < radius)
                        inside = InCorner(x, y, size - radius - 1, radius, radius);
                    else if (x < radius && y >= size - radius)
                        inside = InCorner(x, y, radius, size - radius - 1, radius);
                    else if (x >= size - radius && y >= size - radius)
                        inside = InCorner(x, y, size - radius - 1, size - radius - 1, radius);

                    texture.SetPixel(x, y, inside ? Color.white : Color.clear);
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100,
                0, SpriteMeshType.FullRect, new Vector4(12, 12, 12, 12));
        }

        private static bool InCorner(int x, int y, int cx, int cy, int radius)
        {
            var dx = x - cx;
            var dy = y - cy;
            return dx * dx + dy * dy <= radius * radius;
        }
    }
}
