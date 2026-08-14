using System;
using TMPro;
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
        public static readonly Color WindowColor = new Color(1f, 1f, 1f, 0.97f);
        public static readonly Color CardColor = new Color(0.949f, 0.957f, 0.973f);
        public static readonly Color CardDeepColor = new Color(0.933f, 0.942f, 0.960f);
        public static readonly Color TitleColor = new Color(0.078f, 0.094f, 0.125f);
        public static readonly Color LabelColor = new Color(0.541f, 0.573f, 0.639f);
        public static readonly Color NameColor = new Color(0.122f, 0.141f, 0.188f);
        public static readonly Color MutedColor = new Color(0.765f, 0.788f, 0.831f);
        public static readonly Color HintColor = new Color(0.42f, 0.455f, 0.52f);
        public static readonly Color AccentColor = new Color(0.231f, 0.510f, 0.965f);
        public static readonly Color AccentTextColor = Color.white;
        public static readonly Color PositiveColor = new Color(0.16f, 0.65f, 0.37f);

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
                    barImage.color = WindowColor;
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
