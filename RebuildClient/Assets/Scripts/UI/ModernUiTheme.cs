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
        //stages and the header is the most saturated tone so it reads as a header.
        //The inks are deliberately dark: the canvas draws the whole interface at three
        //quarter scale, so anything less than strong contrast turns to mush on a phone.
        public static readonly Color WindowColor = new Color(0.965f, 0.978f, 0.992f, 0.99f);
        public static readonly Color CardColor = new Color(0.894f, 0.929f, 0.973f);
        public static readonly Color CardDeepColor = new Color(0.831f, 0.886f, 0.953f);
        public static readonly Color TitleBarColor = new Color(0.729f, 0.835f, 0.937f);
        public static readonly Color TabIdleColor = new Color(0.933f, 0.953f, 0.980f);
        //for a panel laid over the game world rather than inside a window: solid enough to
        //read against whatever the player is standing in front of, clear enough that it
        //does not wall off the view
        public static readonly Color PanelOverlayColor = new Color(0.965f, 0.978f, 0.992f, 0.86f);
        public static readonly Color CardBorderColor = new Color(0.784f, 0.843f, 0.914f);
        //Every ink below was measured against every surface above with the contrast
        //formula from WCAG 2.1 and moved until it cleared 4.5 to 1, the ratio at which
        //normal sized text stays readable. The quiet greys were the worst offenders: the
        //muted grey sat at 2.3 to 1 on a card, which is legible on a desk monitor and
        //gone on a phone in daylight.
        public static readonly Color TitleColor = new Color(0.055f, 0.129f, 0.235f);
        public static readonly Color LabelColor = new Color(0.262f, 0.348f, 0.450f);
        public static readonly Color NameColor = new Color(0.075f, 0.145f, 0.239f);
        public static readonly Color MutedColor = new Color(0.304f, 0.355f, 0.414f);
        public static readonly Color HintColor = new Color(0.270f, 0.350f, 0.435f);
        //darkened just enough that white on it clears the same bar, since it is the fill
        //behind every primary button and active tab in the interface
        public static readonly Color AccentColor = new Color(0.165f, 0.435f, 0.780f);
        public static readonly Color AccentTextColor = Color.white;
        //A fill and an ink cannot be the same blue. The fill has to stay light enough for
        //white to read on it and the ink has to go darker to read on a pale card, and one
        //colour trying to do both lands between the two and fails at each. This is the
        //ink: the blue for a label, a subtitle or an NPC's name.
        public static readonly Color AccentInkColor = new Color(0.087f, 0.392f, 0.673f);
        //the ink for a surface too dark to take the near black one
        public static readonly Color LightInkColor = new Color(0.957f, 0.973f, 0.996f);
        //a gain on a stat used to be drawn green; the interface is blue throughout now
        public static readonly Color PositiveColor = AccentInkColor;
        public static readonly Color IconColor = new Color(0.165f, 0.435f, 0.780f);
        public static readonly Color IconMutedColor = new Color(0.396f, 0.475f, 0.561f);

        //one place to change how big text is, so a legibility pass is a single edit
        public const float SizeTitle = 30f;
        public const float SizeSubtitle = 15f;
        public const float SizeValue = 19f;
        public const float SizeBody = 16f;
        public const float SizeLabel = 14f;
        public const float SizeSmall = 13f;

        public const float TitleBarHeight = 76f; //title plus the small subtitle under it
        public const float ShadowSpread = 14f;

        /// <summary>
        /// Left on a window once a skin has claimed it, so the general pass that tidies
        /// up every other window knows to leave the rebuilt ones alone.
        /// </summary>
        public class SkinMarker : MonoBehaviour { }

        public static bool IsSkinned(GameObject target)
        {
            return target != null && target.GetComponent<SkinMarker>() != null;
        }

        public static void MarkSkinned(GameObject target)
        {
            if (target != null && target.GetComponent<SkinMarker>() == null)
                target.AddComponent<SkinMarker>();
        }

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
                    roundedSprite = CreateRoundedSprite(Color.white);
                return roundedSprite;
            }
        }

        private static readonly System.Collections.Generic.Dictionary<Color, Sprite> tintedRounded =
            new System.Collections.Generic.Dictionary<Color, Sprite>();

        /// <summary>
        /// A rounded panel with the colour baked into the pixels rather than applied as
        /// a tint. Windows that swap a sprite to show a state, the character slots being
        /// the one that matters, never touch the image's colour, so the only way to give
        /// those two states different colours is to hand them two different sprites.
        /// </summary>
        public static Sprite TintedRounded(Color color)
        {
            if (tintedRounded.TryGetValue(color, out var existing) && existing != null)
                return existing;

            var sprite = CreateRoundedSprite(color);
            tintedRounded[color] = sprite;
            return sprite;
        }

        private static TMP_FontAsset themeFont;

        /// <summary>
        /// The font the rebuilt windows draw with. The client's default is Liberation
        /// Sans, which carries no Thai at all, so the Thai capable fallback registered
        /// in the TextMeshPro settings is preferred when there is one. Drawing straight
        /// from it rather than leaning on the fallback chain keeps a Thai label in the
        /// same material as the English beside it, and so in the same draw call.
        /// </summary>
        public static TMP_FontAsset ThemeFont
        {
            get
            {
                if (themeFont != null)
                    return themeFont;

                var fallbacks = TMP_Settings.fallbackFontAssets;
                if (fallbacks != null)
                {
                    for (var i = 0; i < fallbacks.Count; i++)
                    {
                        if (fallbacks[i] == null)
                            continue;
                        themeFont = fallbacks[i];
                        return themeFont;
                    }
                }

                themeFont = TMP_Settings.defaultFontAsset;
                return themeFont;
            }
        }

        private static Material crispMaterial;
        private static bool crispMaterialBuilt;

        /// <summary>
        /// One shared copy of the default font's material with the glyph edges pushed
        /// out a little. The interface is drawn at three quarter scale, which leaves a
        /// thirteen point label about ten pixels tall, and at that size the untouched
        /// signed distance field goes thin and grey. Sharing a single material keeps
        /// every label in one draw call, so this costs nothing to batching.
        /// </summary>
        public static Material CrispMaterial
        {
            get
            {
                if (crispMaterialBuilt)
                    return crispMaterial;

                crispMaterialBuilt = true;

                var font = ThemeFont;
                if (font == null || font.material == null)
                    return null;

                try
                {
                    var material = new Material(font.material) { name = font.material.name + " Crisp" };
                    //named rather than looked up through TMP's id table, which is only
                    //filled in once the package has initialised itself.
                    //Kept small: bold text is already thickened by the font style, and
                    //stacking a heavy dilate on top of that filled the counters in and
                    //turned headings into blocks.
                    if (material.HasProperty("_FaceDilate"))
                        material.SetFloat("_FaceDilate", 0.03f);

                    //No drop shadow on the glyphs. A shadow under a letter is a second,
                    //blurred copy of it a pixel away, and at the size this interface draws
                    //that reads as a smeared edge rather than as depth. Depth belongs to
                    //the panels; the text on them wants to be flat and sharp.
                    if (material.HasProperty("_UnderlayColor"))
                        material.SetColor("_UnderlayColor", new Color(0f, 0f, 0f, 0f));
                    if (material.HasProperty("_UnderlayOffsetX"))
                        material.SetFloat("_UnderlayOffsetX", 0f);
                    if (material.HasProperty("_UnderlayOffsetY"))
                        material.SetFloat("_UnderlayOffsetY", 0f);
                    if (material.HasProperty("_UnderlaySoftness"))
                        material.SetFloat("_UnderlaySoftness", 0f);
                    material.DisableKeyword("UNDERLAY_ON");

                    crispMaterial = material;
                }
                catch (Exception e)
                {
                    //not worth failing the whole skin over, the text simply stays as it was
                    Debug.LogWarning($"[ModernUi] Could not build the text material: {e.Message}");
                }

                return crispMaterial;
            }
        }

        /// <summary>
        /// Turns an existing window's own backdrop white and restyles its drag bar
        /// while keeping the bar (and so moving and closing) fully functional.
        /// Returns the drag bar so callers can skip it when hiding old content.
        /// </summary>
        public static Transform ApplyWindowChrome(Component window, Sprite icon = null)
        {
            var root = (RectTransform)window.transform;

            var rootImage = window.GetComponent<Image>();
            //an image the window left clear is there to catch clicks, not to be seen, so
            //painting it would put a panel on screen that was never meant to be there
            if (rootImage != null && rootImage.color.a > 0.1f)
            {
                rootImage.sprite = RoundedSprite;
                rootImage.type = Image.Type.Sliced;
                rootImage.color = WindowColor;
                AddBorder(root, CardBorderColor);
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
                    barText.extraPadding = true;
                }

                foreach (var barButton in child.GetComponentsInChildren<Button>(true))
                {
                    var buttonImage = barButton.GetComponent<Image>();
                    if (buttonImage != null)
                        buttonImage.color = HintColor;
                }

                if (icon != null)
                    AddBarIcon(child, icon);
            }

            return dragBar;
        }

        /// <summary>
        /// Puts an icon at the left end of a window's existing drag bar and moves the
        /// title out of its way. Only text that actually starts at the left is shifted,
        /// so a centred title stays where the window's own layout put it.
        /// </summary>
        private static void AddBarIcon(Transform bar, Sprite icon)
        {
            if (bar.Find("ModernBarIcon") != null)
                return;

            const float shift = 26f;

            foreach (var text in bar.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                var rect = text.rectTransform;
                if (rect.anchorMin.x > 0.4f)
                    continue;

                if (rect.anchorMax.x > rect.anchorMin.x)
                    rect.offsetMin = new Vector2(rect.offsetMin.x + shift, rect.offsetMin.y);
                else
                    rect.anchoredPosition = new Vector2(rect.anchoredPosition.x + shift, rect.anchoredPosition.y);
            }

            var image = CreateIcon(bar, icon, TitleColor, 19);
            image.gameObject.name = "ModernBarIcon";
            Place(image.rectTransform, new Vector2(0, 0.5f), new Vector2(9, 0), new Vector2(19, 19));
        }

        /// <summary>
        /// One channel of a colour converted out of the gamma encoding sRGB stores it in,
        /// which is the first step of the WCAG contrast formula. Averaging the encoded
        /// values instead is the usual mistake and reports mid tones as far lighter than
        /// the eye sees them.
        /// </summary>
        private static float LinearChannel(float value)
        {
            return value <= 0.03928f ? value / 12.92f : Mathf.Pow((value + 0.055f) / 1.055f, 2.4f);
        }

        /// <summary>How much light a colour puts out, on the WCAG 2.1 definition.</summary>
        public static float Luminance(Color color)
        {
            return 0.2126f * LinearChannel(color.r)
                   + 0.7152f * LinearChannel(color.g)
                   + 0.0722f * LinearChannel(color.b);
        }

        /// <summary>
        /// How far apart two colours are to read, from 1 (identical) to 21 (black on
        /// white). Normal sized text wants 4.5 and large text 3.
        /// </summary>
        public static float ContrastRatio(Color a, Color b)
        {
            var first = Luminance(a);
            var second = Luminance(b);
            var lighter = Mathf.Max(first, second);
            var darker = Mathf.Min(first, second);
            return (lighter + 0.05f) / (darker + 0.05f);
        }

        /// <summary>
        /// The ink to write on a given surface: the near black one on anything pale, the
        /// near white one on anything dark, whichever of the two actually reads better
        /// there rather than whichever was guessed at.
        /// </summary>
        public static Color InkFor(Color surface)
        {
            return ContrastRatio(LightInkColor, surface) > ContrastRatio(NameColor, surface)
                ? LightInkColor
                : NameColor;
        }

        private static readonly System.Collections.Generic.Dictionary<Material, Material> unshadowed =
            new System.Collections.Generic.Dictionary<Material, Material>();

        /// <summary>
        /// The same text material with its drop shadow taken off.
        ///
        /// A shadow under a letter is a second, blurred copy of it a pixel away, and at
        /// the size this interface draws that reads as a smeared edge rather than as
        /// depth. Several of the client's labels are set in a material that has one baked
        /// in, so turning it off on our own material was never going to reach them.
        ///
        /// Results are kept per source material, so every label that shared one before
        /// shares the corrected one now and the batching is unchanged. Everything else the
        /// material does, an outline, a glow, a gradient, is copied across untouched.
        /// </summary>
        public static Material WithoutShadow(Material source)
        {
            if (source == null || !source.HasProperty("_UnderlayColor"))
                return source;

            var hasShadow = source.GetColor("_UnderlayColor").a > 0.01f
                            || source.IsKeywordEnabled("UNDERLAY_ON");
            if (!hasShadow)
                return source;

            if (unshadowed.TryGetValue(source, out var cached) && cached != null)
                return cached;

            var copy = new Material(source) { name = source.name + " Flat" };
            copy.SetColor("_UnderlayColor", new Color(0f, 0f, 0f, 0f));
            if (copy.HasProperty("_UnderlayOffsetX"))
                copy.SetFloat("_UnderlayOffsetX", 0f);
            if (copy.HasProperty("_UnderlayOffsetY"))
                copy.SetFloat("_UnderlayOffsetY", 0f);
            if (copy.HasProperty("_UnderlaySoftness"))
                copy.SetFloat("_UnderlaySoftness", 0f);
            copy.DisableKeyword("UNDERLAY_ON");

            unshadowed[source] = copy;
            return copy;
        }

        /// <summary>
        /// The accent blue darkened as far as it has to go to read on a given surface. The
        /// blue that clears the bar on a white card does not clear it on the tinted band
        /// of a header, and settling that per surface is more dependable than picking one
        /// blue and hoping every place it lands is pale enough for it.
        /// </summary>
        public static Color AccentInkOn(Color surface)
        {
            var ink = AccentInkColor;

            //a bounded walk rather than a solve: twelve steps takes any starting colour
            //to near black, so it always finishes and always finishes readable
            for (var i = 0; i < 12 && ContrastRatio(ink, surface) < 4.5f; i++)
                ink = new Color(ink.r * 0.85f, ink.g * 0.85f, ink.b * 0.85f, ink.a);

            return ink;
        }

        /// <summary>
        /// The colour actually behind an element: the first parent painting something
        /// solid enough to be what the eye sees. Returns false when nothing under it is
        /// opaque, which means the element is sitting straight on the game world and no
        /// single ink is right for it, so it is better left as the game drew it.
        /// </summary>
        public static bool TryGetSurface(Transform start, out Color surface)
        {
            surface = WindowColor;

            for (var t = start; t != null; t = t.parent)
            {
                var image = t.GetComponent<Image>();
                if (image == null || !image.enabled || image.color.a < 0.5f)
                    continue;

                surface = image.color;
                return true;
            }

            return false;
        }

        /// <summary>
        /// Repaints every neutral label under the root to whichever ink reads on the panel
        /// it is standing on. Text carrying a colour of its own, a green gain or a red
        /// warning, is saying something with that colour and is left alone.
        /// </summary>
        public static void RepaintInk(Transform root)
        {
            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                //A shadow or an outline behind a letter is a second copy of it a pixel
                //away, and at the size this interface draws it reads as a smeared edge
                //rather than as depth. Depth is the panels' job. Outline derives from
                //Shadow, so asking for one finds both.
                foreach (var shadow in text.GetComponents<Shadow>())
                    shadow.enabled = false;

                //and the same again for a shadow baked into the material, which is where
                //most of the client's own labels get theirs
                text.fontSharedMaterial = WithoutShadow(text.fontSharedMaterial);

                var c = text.color;
                var max = Mathf.Max(c.r, Mathf.Max(c.g, c.b));
                var min = Mathf.Min(c.r, Mathf.Min(c.g, c.b));
                if (max - min >= 0.18f)
                    continue;

                if (TryGetSurface(text.transform, out var surface))
                    text.color = InkFor(surface);
            }
        }

        /// <summary>
        /// Builds a header across the top of a rebuilt window: a tinted bar carrying the
        /// window name and a close button, and doubling as the drag handle. Rebuilt
        /// windows hide their original chrome, so without this they have no way to be
        /// moved or closed at all.
        /// </summary>
        public static RectTransform CreateTitleBar(WindowBase window, string title, string subtitle = null,
            Sprite icon = null)
        {
            var root = (RectTransform)window.transform;

            //assembled while inactive so the drag handle can be pointed at its window
            //before anything starts listening for pointers on it
            var barObject = new GameObject("ModernTitleBar", typeof(Image));
            barObject.SetActive(false);
            barObject.transform.SetParent(root, false);

            //A tinted band rather than the clear one this used to be. Left clear, the top
            //of a window was the same flat sheet as the rest of it and nothing said where
            //the chrome ended and the content began; a second tone up there is what gives
            //a window a top. It still catches drags, being the same image.
            var image = barObject.GetComponent<Image>();
            image.sprite = HeaderSprite;
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

            var textLeft = 24f;
            if (icon != null)
            {
                //Lined up with the title rather than centred in the band. The band is not
                //always the same height, and at 38 tall from 18 down the badge ran past
                //the foot of a short one and sat on the rule.
                var badge = CreateCard(bar, "Icon", AccentColor);
                Place(badge, new Vector2(0, 1), new Vector2(22, -12), new Vector2(34, 34));
                CreateIcon(badge, icon, AccentTextColor, 20);
                textLeft = 72f;
            }

            var label = CreateText(bar, "Title", title, SizeTitle - 2, TitleColor, TextAlignmentOptions.BottomLeft,
                FontStyles.Bold);
            Place((RectTransform)label.transform, new Vector2(0, 1), new Vector2(textLeft, -12), new Vector2(420, 34));

            if (!string.IsNullOrEmpty(subtitle))
            {
                //measured against the band it lands on, not against the window behind it
                var sub = CreateText(bar, "Subtitle", subtitle, SizeSubtitle, AccentInkOn(TitleBarColor),
                    TextAlignmentOptions.TopLeft);
                Place((RectTransform)sub.transform, new Vector2(0, 1), new Vector2(textLeft, -48), new Vector2(420, 22));
            }

            //a hairline of the accent along the foot of the band, which is what stops the
            //two blues reading as one soft area and gives the header an edge to sit on
            var rule = new GameObject("Rule", typeof(Image));
            rule.transform.SetParent(bar, false);
            var ruleImage = rule.GetComponent<Image>();
            ruleImage.color = AccentColor;
            ruleImage.raycastTarget = false;

            var ruleRect = (RectTransform)rule.transform;
            ruleRect.anchorMin = new Vector2(0, 0);
            ruleRect.anchorMax = new Vector2(1, 0);
            ruleRect.pivot = new Vector2(0.5f, 0);
            ruleRect.offsetMin = Vector2.zero;
            ruleRect.offsetMax = new Vector2(0, 3);

            //on the band the card tone is barely a step away, so the close button takes
            //the window tone instead and reads as a control rather than as a smudge
            var close = CreateButton(bar, "Close", "", WindowColor, TitleColor, SizeBody);
            Place((RectTransform)close.transform, new Vector2(1, 1), new Vector2(-14, -14), new Vector2(36, 36));
            //the two pale tones are only 1.4 to 1 apart, so the edge is what actually
            //draws the button rather than the fill
            AddBorder((RectTransform)close.transform, CardBorderColor);
            CreateIcon((RectTransform)close.transform, ModernUiIcons.Close, HintColor, 15);
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

        private static Sprite shadowSprite;

        public static Sprite ShadowSprite
        {
            get
            {
                if (shadowSprite == null)
                    shadowSprite = CreateShadowSprite();
                return shadowSprite;
            }
        }

        /// <summary>
        /// Lays a soft shadow around a window. It goes in as the first child rather than
        /// a sibling so it follows the window when dragged: the sprite is clear through
        /// the middle, so the part covering the window shows nothing and only the falloff
        /// past the edges is visible.
        /// </summary>
        public static void AttachShadow(RectTransform window, float spread = ShadowSpread)
        {
            if (window == null || window.Find("ModernShadow") != null)
                return;

            var go = new GameObject("ModernShadow", typeof(Image));
            go.transform.SetParent(window, false);
            go.transform.SetAsFirstSibling();

            var image = go.GetComponent<Image>();
            image.sprite = ShadowSprite;
            image.type = Image.Type.Sliced;
            image.raycastTarget = false;

            var rect = (RectTransform)go.transform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            //biased downward, the way a shadow from a light overhead actually falls: an
            //evenly spread halo reads as a glow rather than as height off the page
            rect.offsetMin = new Vector2(-spread, -spread - 5f);
            rect.offsetMax = new Vector2(spread, spread - 5f);
        }

        /// <summary>
        /// Gives a row of tab buttons the filled active look. Which tab is active is
        /// tracked here purely for appearance, the window keeps its own tab logic.
        /// </summary>
        public static void StyleTabBar(System.Collections.Generic.IList<Button> tabs, int activeIndex = 0)
        {
            if (tabs == null || tabs.Count == 0)
                return;

            var group = new TabGroup { Tabs = tabs, Borders = new Image[tabs.Count] };
            for (var i = 0; i < tabs.Count; i++)
            {
                var tab = tabs[i];
                if (tab == null)
                    continue;

                var image = tab.GetComponent<Image>();
                if (image != null)
                {
                    image.sprite = RoundedSprite;
                    image.type = Image.Type.Sliced;
                }

                //an idle tab in the tab tone is barely a step from the panel behind it, so
                //it carries an edge as well; without one a tab waiting to be pressed is
                //not visibly a thing that can be pressed
                group.Borders[i] = AddBorder((RectTransform)tab.transform, CardBorderColor)
                                   ?? tab.transform.Find("ModernBorder")?.GetComponent<Image>();

                var index = i;
                tab.onClick.AddListener(() => group.SetActive(index));
            }

            group.SetActive(activeIndex);
        }

        private class TabGroup
        {
            public System.Collections.Generic.IList<Button> Tabs;
            public Image[] Borders;

            public void SetActive(int active)
            {
                for (var i = 0; i < Tabs.Count; i++)
                {
                    var tab = Tabs[i];
                    if (tab == null)
                        continue;

                    var isActive = i == active;
                    var image = tab.GetComponent<Image>();
                    if (image != null)
                        image.color = isActive ? AccentColor : CardColor;

                    if (Borders != null && i < Borders.Length && Borders[i] != null)
                        Borders[i].color = isActive ? AccentColor : CardBorderColor;

                    foreach (var label in tab.GetComponentsInChildren<TextMeshProUGUI>(true))
                    {
                        label.color = isActive ? AccentTextColor : NameColor;
                        label.fontStyle = FontStyles.Bold;
                    }
                }
            }
        }

        /// <summary>
        /// Drops one of the drawn icons in, centred on its parent by default. The sprite
        /// is white, so the color given here is what the icon ends up being.
        /// </summary>
        public static Image CreateIcon(Transform parent, Sprite icon, Color color, float size)
        {
            var go = new GameObject("Icon", typeof(Image));
            go.transform.SetParent(parent, false);

            var image = go.GetComponent<Image>();
            image.sprite = icon;
            image.color = color;
            image.raycastTarget = false;
            image.preserveAspect = true;

            var rect = (RectTransform)go.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(size, size);
            return image;
        }

        /// <summary>
        /// A button with its icon on the left and the label reading from just after it,
        /// which is how the reference menus are laid out.
        /// </summary>
        public static Button CreateIconButton(Transform parent, string name, string label, Sprite icon,
            Color background, Color textColor, float fontSize = SizeBody)
        {
            var button = CreateButton(parent, name, label, background, textColor, fontSize);
            var rect = (RectTransform)button.transform;

            var glyph = CreateIcon(rect, icon, textColor, 20);
            Place((RectTransform)glyph.transform, new Vector2(0, 0.5f), new Vector2(16, 0), new Vector2(20, 20));

            var text = button.GetComponentInChildren<TextMeshProUGUI>(true);
            if (text != null)
            {
                text.alignment = TextAlignmentOptions.Left;
                Stretch(text.rectTransform, 48, 2, -14, -2);
            }

            return button;
        }

        /// <summary>
        /// Turns any strongly green element under the root blue. The game's own windows
        /// use green for confirm buttons, highlighted tabs and gains, which fought with
        /// the blue everything else has moved to.
        /// </summary>
        public static void RecolorAccents(Transform root)
        {
            foreach (var image in root.GetComponentsInChildren<Image>(true))
            {
                if (IsGreen(image.color))
                    image.color = AccentColor;
            }

            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                //the ink, not the fill: this is a word on a pale card, not a button face
                if (IsGreen(text.color))
                    text.color = AccentInkColor;
            }
        }

        private static bool IsGreen(Color c)
        {
            //green only counts when that channel clearly leads the other two, which
            //leaves item sprites, white icons and grey chrome untouched
            return c.a > 0.2f && c.g > 0.35f && c.g - c.r > 0.12f && c.g - c.b > 0.12f;
        }

        private static Sprite CreateShadowSprite()
        {
            const int size = 64;
            const int inset = 20;
            const int radius = 12;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);

            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    //distance outside the inner rounded rect, clear within it so the
                    //window underneath is never darkened
                    var dx = Mathf.Max(inset + radius - x, x - (size - 1 - inset - radius), 0);
                    var dy = Mathf.Max(inset + radius - y, y - (size - 1 - inset - radius), 0);
                    var distance = Mathf.Sqrt(dx * dx + dy * dy) - radius;

                    var alpha = 0f;
                    if (distance > 0)
                    {
                        var t = Mathf.Clamp01(distance / inset);
                        alpha = 0.34f * (1f - t) * (1f - t);
                    }

                    texture.SetPixel(x, y, new Color(0.05f, 0.11f, 0.20f, alpha));
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100,
                0, SpriteMeshType.FullRect, new Vector4(30, 30, 30, 30));
        }

        //The gauges along the top of the screen. Each hue is darkened to the point where
        //white bold text on it clears 4.5 to 1, since the reading is printed across the
        //bar itself, and they are told apart by hue rather than by brightness so that all
        //four sit at the same weight beside each other.
        public static readonly Color GaugeTrackColor = new Color(0.106f, 0.145f, 0.196f);
        public static readonly Color GaugeHealthColor = new Color(0.184f, 0.523f, 0.215f);
        public static readonly Color GaugeManaColor = new Color(0.205f, 0.451f, 0.820f);
        public static readonly Color GaugeExpColor = new Color(0.595f, 0.428f, 0.119f);
        public static readonly Color GaugeJobExpColor = new Color(0.547f, 0.362f, 0.805f);

        private static Sprite gaugeSprite;

        /// <summary>
        /// A rounded bar carrying a top lit gradient in its pixels. Multiplying that
        /// against whatever colour a gauge is tinted is what gives a flat rectangle its
        /// roundness; the alternative, a second image laid over every bar, doubles the
        /// draw calls for the part of the screen that redraws most often.
        /// </summary>
        public static Sprite GaugeSprite
        {
            get
            {
                if (gaugeSprite == null)
                    gaugeSprite = CreateGaugeSprite();
                return gaugeSprite;
            }
        }

        private static Sprite CreateGaugeSprite()
        {
            const int size = 32;
            const int radius = 12;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);

            for (var y = 0; y < size; y++)
            {
                var height = (y + 0.5f) / size;
                var shade = Mathf.Lerp(0.56f, 1f, Mathf.Pow(height, 0.7f));
                //a narrow band of extra light below the top edge, which is the highlight
                //the eye reads as a curved surface rather than a painted rectangle
                var highlight = Mathf.Exp(-Mathf.Pow((height - 0.76f) / 0.11f, 2f)) * 0.16f;
                var value = Mathf.Clamp01(shade + highlight);

                for (var x = 0; x < size; x++)
                {
                    var distance = RoundedDistance(x, y, size, radius);
                    var alpha = Mathf.Clamp01(0.5f - distance);
                    texture.SetPixel(x, y, new Color(value, value, value, alpha));
                }
            }

            texture.Apply();
            //sliced left and right only. With no border top or bottom the whole height is
            //stretched to the bar, so the gradient scales with it instead of a middle band
            //being smeared out between two fixed caps.
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100,
                0, SpriteMeshType.FullRect, new Vector4(12, 0, 12, 0));
        }

        /// <summary>
        /// Draws a slider as a read-only gauge: a sunken dark channel with a lit bar in
        /// it. The handle is taken off, because a health bar is not something to drag.
        /// </summary>
        public static void StyleGauge(Slider slider, Color fill)
        {
            if (slider == null)
                return;

            var track = slider.GetComponent<Image>();
            if (track == null)
            {
                var background = slider.transform.Find("Background");
                if (background != null)
                    track = background.GetComponent<Image>();
            }

            if (track != null)
            {
                track.sprite = GaugeSprite;
                track.type = Image.Type.Sliced;
                track.color = GaugeTrackColor;
            }

            if (slider.fillRect != null)
            {
                var bar = slider.fillRect.GetComponent<Image>();
                if (bar != null)
                {
                    bar.sprite = GaugeSprite;
                    bar.type = Image.Type.Sliced;
                    bar.color = fill;
                }
            }

            if (slider.handleRect != null)
                slider.handleRect.gameObject.SetActive(false);
        }

        /// <summary>
        /// Turns the resize target in the corner of a window into a small grip. The
        /// original is a 120 by 30 image, which under the new panel colours read as a
        /// stray bar lying across the bottom of the window. The rect is left exactly as
        /// it was so that whatever listens for the drag still has the same area to
        /// listen over, and only what is drawn inside it changes.
        /// </summary>
        public static void StyleResizeGrip(Transform root)
        {
            foreach (var child in root.GetComponentsInChildren<Transform>(true))
            {
                if (child.name.IndexOf("ResizeHandle", StringComparison.OrdinalIgnoreCase) < 0)
                    continue;

                var image = child.GetComponent<Image>();
                if (image != null)
                    image.color = new Color(1f, 1f, 1f, 0f);

                if (child.Find("ModernGrip") != null)
                    continue;

                var grip = CreateCard(child, "ModernGrip", IconMutedColor);
                Place(grip, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(44, 4));
                grip.GetComponent<Image>().raycastTarget = false;
            }
        }

        /// <summary>
        /// A thin blue handle running on a soft track, in place of the boxy default.
        /// </summary>
        public static void StyleScrollbar(Scrollbar bar)
        {
            if (bar == null)
                return;

            var track = bar.GetComponent<Image>();
            if (track != null)
            {
                track.sprite = RoundedSprite;
                track.type = Image.Type.Sliced;
                track.color = CardDeepColor;
            }

            if (bar.handleRect == null)
                return;

            var handle = bar.handleRect.GetComponent<Image>();
            if (handle != null)
            {
                handle.sprite = RoundedSprite;
                handle.type = Image.Type.Sliced;
                handle.color = AccentColor;
            }
        }

        /// <summary>
        /// Styles every scroll view under the root and drops the sideways bar. Nothing in
        /// this interface is wider than its window, so a horizontal bar only ever eats a
        /// strip along the bottom of a list, which is what hid the skill point count.
        /// </summary>
        public static void StyleScrollViews(Transform root)
        {
            foreach (var scroll in root.GetComponentsInChildren<ScrollRect>(true))
            {
                StyleScrollbar(scroll.verticalScrollbar);
                scroll.horizontal = false;
                scroll.horizontalScrollbar = null;
            }

            //Swept by which way the bar runs rather than by the name the prefab gave it or
            //by the scroll view still holding a reference to it. Clearing the reference
            //above stops the scroll view putting the bar back, but it also means an object
            //already left on screen is no longer anyone's to hide.
            foreach (var bar in root.GetComponentsInChildren<Scrollbar>(true))
            {
                if (bar.direction == Scrollbar.Direction.LeftToRight ||
                    bar.direction == Scrollbar.Direction.RightToLeft)
                    bar.gameObject.SetActive(false);
                else
                    StyleScrollbar(bar);
            }
        }

        /// <summary>
        /// Gives a text box the card look, a blue caret and a readable placeholder.
        /// </summary>
        public static void StyleInputField(TMP_InputField field)
        {
            if (field == null)
                return;

            var image = field.GetComponent<Image>();
            if (image != null)
            {
                image.sprite = RoundedSprite;
                image.type = Image.Type.Sliced;
                image.color = CardColor;
            }

            if (field.textComponent != null)
            {
                field.textComponent.color = NameColor;
                field.textComponent.fontSize = SizeBody;
                field.textComponent.extraPadding = true;
            }

            if (field.placeholder is TextMeshProUGUI placeholder)
            {
                placeholder.color = MutedColor;
                placeholder.fontSize = SizeBody;
                placeholder.extraPadding = true;
            }

            field.customCaretColor = true;
            field.caretColor = AccentColor;
            field.selectionColor = new Color(AccentColor.r, AccentColor.g, AccentColor.b, 0.28f);
        }

        /// <summary>
        /// Draws sliders as a thin track with a blue fill and a round handle.
        /// Only the ones the player can actually drag are touched: a health or cast bar
        /// is built from the same component, and its colour is carrying a meaning that
        /// painting it blue would throw away.
        /// </summary>
        public static void StyleSliders(Transform root)
        {
            foreach (var slider in root.GetComponentsInChildren<Slider>(true))
            {
                if (!slider.interactable)
                    continue;

                if (slider.fillRect != null)
                {
                    var fill = slider.fillRect.GetComponent<Image>();
                    if (fill != null)
                    {
                        fill.sprite = RoundedSprite;
                        fill.type = Image.Type.Sliced;
                        fill.color = AccentColor;
                    }
                }

                if (slider.handleRect != null)
                {
                    var handle = slider.handleRect.GetComponent<Image>();
                    if (handle != null)
                    {
                        handle.sprite = RoundedSprite;
                        handle.type = Image.Type.Sliced;
                        handle.color = AccentColor;
                    }
                }

                //the track sits behind both of those, on the slider itself
                var track = slider.GetComponent<Image>();
                if (track != null)
                {
                    track.sprite = RoundedSprite;
                    track.type = Image.Type.Sliced;
                    track.color = CardDeepColor;
                }
            }
        }

        /// <summary>
        /// Lays a card behind an element the window keeps writing into, matched to that
        /// element's own rect and padded out a little. Building it from the rect rather
        /// than from guessed coordinates means it lands correctly in a layout this code
        /// has never seen. Returns null when there is already one there.
        /// </summary>
        public static RectTransform CardBehind(RectTransform target, string name, Color color, float padX = 16,
            float padY = 8)
        {
            if (target == null)
                return null;

            var parent = target.parent;
            if (parent == null || parent.Find(name) != null)
                return null;

            var card = CreateCard(parent, name, color, true);
            card.anchorMin = target.anchorMin;
            card.anchorMax = target.anchorMax;
            card.pivot = target.pivot;
            //the offsets place and size the card in one go, whether the element they were
            //read from is stretched or pinned to a corner
            card.offsetMin = target.offsetMin - new Vector2(padX, padY);
            card.offsetMax = target.offsetMax + new Vector2(padX, padY);
            card.GetComponent<Image>().raycastTarget = false;
            //behind the thing it is backing, never over it
            card.SetSiblingIndex(target.GetSiblingIndex());
            return card;
        }

        public static RectTransform CreateRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        public static RectTransform CreateCard(Transform parent, string name, Color color, bool bordered = false)
        {
            var go = new GameObject(name, typeof(Image));
            go.transform.SetParent(parent, false);
            var image = go.GetComponent<Image>();
            image.sprite = RoundedSprite;
            image.type = Image.Type.Sliced;
            image.color = color;

            var rect = (RectTransform)go.transform;
            if (bordered)
                AddBorder(rect, CardBorderColor);
            return rect;
        }

        public static TextMeshProUGUI CreateText(Transform parent, string name, string content, float size,
            Color color, TextAlignmentOptions alignment, FontStyles style = FontStyles.Normal)
        {
            var go = new GameObject(name, typeof(TextMeshProUGUI));
            go.transform.SetParent(parent, false);

            var text = go.GetComponent<TextMeshProUGUI>();
            if (ThemeFont != null)
            {
                text.font = ThemeFont;
                var material = CrispMaterial;
                if (material != null)
                    text.fontSharedMaterial = material;
            }

            text.text = content;
            text.fontSize = size;
            text.color = color;
            text.alignment = alignment;
            text.fontStyle = style;
            text.raycastTarget = false;
            //the thickened glyphs need a little more room in the atlas sampling window,
            //without this the outermost edge of a letter can be clipped away
            text.extraPadding = true;
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
            Color textColor, float fontSize = SizeBody, FontStyles style = FontStyles.Bold)
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

        private const int PanelSize = 32;
        private const int PanelRadius = 10;

        /// <summary>
        /// How far a point lies outside a rounded rectangle filling the texture: negative
        /// inside, zero on the outline, positive outside. Working from a distance rather
        /// than an inside or outside test is what lets both the panel and its border come
        /// out with smooth corners instead of a staircase.
        /// </summary>
        private static float RoundedDistance(int x, int y, int size, int radius)
        {
            var half = size * 0.5f;
            var dx = Mathf.Abs(x + 0.5f - half) - (half - radius);
            var dy = Mathf.Abs(y + 0.5f - half) - (half - radius);
            var outside = new Vector2(Mathf.Max(dx, 0f), Mathf.Max(dy, 0f)).magnitude;
            var inside = Mathf.Min(Mathf.Max(dx, dy), 0f);
            return outside + inside - radius;
        }

        private static Sprite CreateRoundedSprite(Color fill)
        {
            var texture = new Texture2D(PanelSize, PanelSize, TextureFormat.RGBA32, false);

            for (var y = 0; y < PanelSize; y++)
            {
                for (var x = 0; x < PanelSize; x++)
                {
                    var distance = RoundedDistance(x, y, PanelSize, PanelRadius);
                    //one pixel of falloff across the edge, which is what takes the jaggies
                    //off the corners at the size these panels are actually drawn
                    var alpha = Mathf.Clamp01(0.5f - distance);
                    texture.SetPixel(x, y, new Color(fill.r, fill.g, fill.b, fill.a * alpha));
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, PanelSize, PanelSize), new Vector2(0.5f, 0.5f), 100,
                0, SpriteMeshType.FullRect, new Vector4(12, 12, 12, 12));
        }

        private static Sprite headerSprite;

        /// <summary>
        /// A panel rounded across the top and square along the bottom, for a header band
        /// that has to meet the window's own corners up there and run straight into the
        /// body below. The all-round panel leaves a sliver of window showing under each
        /// bottom corner of the band, which is exactly the sort of gap that reads as a
        /// mistake rather than as a shape.
        /// </summary>
        public static Sprite HeaderSprite
        {
            get
            {
                if (headerSprite == null)
                    headerSprite = CreateHeaderSprite();
                return headerSprite;
            }
        }

        private static Sprite CreateHeaderSprite()
        {
            var texture = new Texture2D(PanelSize, PanelSize, TextureFormat.RGBA32, false);
            var half = PanelSize * 0.5f;

            for (var y = 0; y < PanelSize; y++)
            {
                for (var x = 0; x < PanelSize; x++)
                {
                    var dx = Mathf.Abs(x + 0.5f - half) - (half - PanelRadius);
                    var dy = y + 0.5f - (PanelSize - PanelRadius);
                    var outside = new Vector2(Mathf.Max(dx, 0f), Mathf.Max(dy, 0f)).magnitude;
                    var inside = Mathf.Min(Mathf.Max(dx, dy), 0f);
                    //the second term cuts the shape off flat along the bottom edge
                    var distance = Mathf.Max(outside + inside - PanelRadius, -(y + 0.5f));
                    texture.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Clamp01(0.5f - distance)));
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, PanelSize, PanelSize), new Vector2(0.5f, 0.5f), 100,
                0, SpriteMeshType.FullRect, new Vector4(12, 2, 12, 12));
        }

        private static Sprite outlineSprite;

        /// <summary>
        /// The same rounded rectangle drawn as an outline with nothing in the middle, so
        /// it can be laid over a panel to give it an edge without a second panel behind.
        /// </summary>
        public static Sprite OutlineSprite
        {
            get
            {
                if (outlineSprite == null)
                    outlineSprite = CreateOutlineSprite();
                return outlineSprite;
            }
        }

        private static Sprite CreateOutlineSprite()
        {
            const float thickness = 2f;
            var texture = new Texture2D(PanelSize, PanelSize, TextureFormat.RGBA32, false);

            for (var y = 0; y < PanelSize; y++)
            {
                for (var x = 0; x < PanelSize; x++)
                {
                    var distance = RoundedDistance(x, y, PanelSize, PanelRadius);
                    //the stroke runs just inside the outline rather than centred on it, so
                    //it never creeps past the edge of the panel it is edging. Distance is
                    //measured from the middle of that band and faded over half a pixel
                    //either side, which is what keeps the corners smooth.
                    var fromBand = Mathf.Abs(distance + thickness * 0.5f);
                    var alpha = Mathf.Clamp01(thickness * 0.5f - fromBand + 0.5f);
                    texture.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, PanelSize, PanelSize), new Vector2(0.5f, 0.5f), 100,
                0, SpriteMeshType.FullRect, new Vector4(12, 12, 12, 12));
        }

        /// <summary>
        /// Lays a hairline edge over a panel. It goes in last so window content cannot
        /// paint over the stroke, and it never takes pointer input, so a border across a
        /// button does not stop the button being pressed.
        /// </summary>
        public static Image AddBorder(RectTransform target, Color color)
        {
            if (target == null || target.Find("ModernBorder") != null)
                return null;

            var go = new GameObject("ModernBorder", typeof(Image));
            go.transform.SetParent(target, false);
            go.transform.SetAsLastSibling();

            var image = go.GetComponent<Image>();
            image.sprite = OutlineSprite;
            image.type = Image.Type.Sliced;
            image.color = color;
            image.raycastTarget = false;

            Stretch((RectTransform)go.transform, 0, 0, 0, 0);
            return image;
        }
    }
}
