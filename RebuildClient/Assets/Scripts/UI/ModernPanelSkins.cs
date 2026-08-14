using Assets.Scripts.UI.ConfigWindow;
using Assets.Scripts.UI.Inventory;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// Applies the shared card theme to the windows that keep their own layout. The
    /// inventory, skill, options and emote windows are named here because each has
    /// pieces worth treating individually; everything else the game opens is picked up
    /// by a slower sweep that gives it the same panel, ink and accent colours, so a
    /// shop or an item description no longer looks like it came from another game.
    /// Item and skill entries spawn from template objects, so restyling the template
    /// once is enough to cover every future entry.
    /// </summary>
    public class ModernPanelSkins : MonoBehaviour
    {
        private const float SweepInterval = 0.5f;

        private EmoteWindow emoteWindow;

        //the general pass holds off at first so the windows with a skin of their own get
        //to claim themselves before anything else touches them
        private float sweepTimer = 2f;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernPanelSkins>() != null)
                return;

            var host = new GameObject("ModernPanelSkins");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernPanelSkins>();
        }

        private void Update()
        {
            var ui = UiManager.Instance;
            if (ui == null)
                return;

            if (ui.InventoryWindow != null && !ModernUiTheme.IsSkinned(ui.InventoryWindow.gameObject))
                SkinInventory(ui.InventoryWindow);

            if (ui.SkillManager != null && !ModernUiTheme.IsSkinned(ui.SkillManager.gameObject))
                SkinSkills(ui.SkillManager);

            if (ui.ConfigManager != null && !ModernUiTheme.IsSkinned(ui.ConfigManager.gameObject))
                SkinOptions(ui.ConfigManager);

            if (emoteWindow == null)
                emoteWindow = FindFirstObjectByType<EmoteWindow>(FindObjectsInactive.Include);
            if (emoteWindow != null && !ModernUiTheme.IsSkinned(emoteWindow.gameObject))
                SkinEmotes(emoteWindow);

            //windows built from prefabs appear long after the scene loads, so the general
            //pass runs on a timer rather than only once
            sweepTimer -= Time.deltaTime;
            if (sweepTimer > 0)
                return;
            sweepTimer = SweepInterval;

            SweepRemainingWindows(ui);
        }

        private static void SkinInventory(PlayerInventoryWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Bag);
            ModernUiTheme.AttachShadow((RectTransform)win.transform);

            if (win.WeightText != null)
                win.WeightText.color = ModernUiTheme.NameColor;

            ModernUiTheme.StyleTabBar(win.UiTabButtons);

            //the scroll area behind the item grid becomes a soft gray card
            if (win.ViewBoxTransform != null)
            {
                var viewImage = win.ViewBoxTransform.GetComponent<Image>();
                if (viewImage != null)
                {
                    viewImage.sprite = ModernUiTheme.RoundedSprite;
                    viewImage.type = Image.Type.Sliced;
                    viewImage.color = ModernUiTheme.CardDeepColor;
                }
            }

            //item counts spawn from this template, darken them once and every
            //future entry inherits it. Existing entries get the same treatment.
            if (win.ItemEntryPrefab != null)
                ModernUiTheme.RecolorLightTexts(win.ItemEntryPrefab.transform);
            if (win.ItemBoxRoot != null)
                ModernUiTheme.RecolorLightTexts(win.ItemBoxRoot);

            ModernUiTheme.RecolorLightTexts(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);

            Debug.Log("[ModernPanelSkins] Retinted the inventory window.");
        }

        private static void SkinSkills(SkillWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Book);

            var root = (RectTransform)win.transform;
            if (root.sizeDelta.x < 460f)
                root.sizeDelta = new Vector2(460f, Mathf.Max(root.sizeDelta.y, 560f));

            //the horizontal scrollbar runs along the bottom of the window straight over
            //the points readout, and a list of skills has nothing to scroll sideways to
            var horizontal = FindDeep(win.transform, "Scrollbar Horizontal");
            if (horizontal != null)
                horizontal.gameObject.SetActive(false);

            var scroll = win.GetComponentInChildren<ScrollRect>(true);
            if (scroll != null)
            {
                scroll.horizontal = false;
                scroll.horizontalScrollbar = null;
                StyleScrollbar(scroll.verticalScrollbar);
            }

            ModernUiTheme.AttachShadow(root);
            ModernUiTheme.StyleTabBar(win.Tabs);

            //the hover tooltip becomes a white card with dark text
            if (win.TooltipBox != null)
            {
                var tipImage = win.TooltipBox.GetComponent<Image>();
                if (tipImage != null)
                {
                    tipImage.sprite = ModernUiTheme.RoundedSprite;
                    tipImage.type = Image.Type.Sliced;
                    tipImage.color = ModernUiTheme.WindowColor;
                }
            }

            if (win.TooltipText != null)
                win.TooltipText.color = ModernUiTheme.NameColor;

            //skill rows are cloned from this template, so styling it covers everything
            //the window builds from here on, and the rows already made are done directly
            StyleSkillEntry(win.TemplateObject);
            foreach (var entry in win.GetComponentsInChildren<SkillWindowEntry>(true))
                StyleSkillEntry(entry);

            ModernUiTheme.RecolorLightTexts(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);

            //after the sweeps, so nothing repaints the number the window is here for
            StylePointsReadout(win);

            Debug.Log("[ModernPanelSkins] Retinted the skill window.");
        }

        /// <summary>
        /// Gives the skill point count a card of its own. It shares a parent with
        /// whatever the original layout put around it, so the card is built from that
        /// rect rather than from coordinates guessed at from the outside.
        /// </summary>
        private static void StylePointsReadout(SkillWindow win)
        {
            var points = win.PointsText;
            if (points == null)
                return;

            var rect = points.rectTransform;
            var parent = rect.parent;
            if (parent != null && parent.Find("ModernPointsCard") == null)
            {
                var card = ModernUiTheme.CreateCard(parent, "ModernPointsCard", ModernUiTheme.CardDeepColor);
                card.anchorMin = rect.anchorMin;
                card.anchorMax = rect.anchorMax;
                card.pivot = rect.pivot;
                card.anchoredPosition = rect.anchoredPosition;
                card.sizeDelta = rect.sizeDelta + new Vector2(16, 8);
                card.GetComponent<Image>().raycastTarget = false;
                //behind the text, which the window keeps writing into
                card.SetSiblingIndex(rect.GetSiblingIndex());
            }

            points.color = ModernUiTheme.NameColor;
            points.fontStyle = FontStyles.Bold;
            points.fontSize = ModernUiTheme.SizeBody;
            points.extraPadding = true;
        }

        /// <summary>
        /// Makes a skill row read like the rest of the theme: a strong name, quiet
        /// numbers and a hairline separating it from the row below.
        /// </summary>
        private static void StyleSkillEntry(SkillWindowEntry entry)
        {
            if (entry == null)
                return;

            if (entry.SkillName != null)
            {
                entry.SkillName.color = ModernUiTheme.NameColor;
                entry.SkillName.fontSize = ModernUiTheme.SizeBody;
                entry.SkillName.fontStyle = FontStyles.Bold;
                entry.SkillName.extraPadding = true;
            }

            StyleEntryDetail(entry.TextCurLevel);
            StyleEntryDetail(entry.TextMaxLevel);
            StyleEntryDetail(entry.SPCost);

            if (entry.transform.Find("ModernDivider") != null)
                return;

            var divider = ModernUiTheme.CreateCard(entry.transform, "ModernDivider", ModernUiTheme.CardBorderColor);
            divider.anchorMin = new Vector2(0, 0);
            divider.anchorMax = new Vector2(1, 0);
            divider.pivot = new Vector2(0.5f, 0);
            divider.offsetMin = new Vector2(10, 0);
            divider.offsetMax = new Vector2(-10, 1);
            divider.GetComponent<Image>().raycastTarget = false;
        }

        private static void StyleEntryDetail(TextMeshProUGUI text)
        {
            if (text == null)
                return;

            text.color = ModernUiTheme.LabelColor;
            text.fontSize = ModernUiTheme.SizeSmall;
            text.extraPadding = true;
        }

        private static void StyleScrollbar(Scrollbar bar)
        {
            if (bar == null)
                return;

            var track = bar.GetComponent<Image>();
            if (track != null)
            {
                track.sprite = ModernUiTheme.RoundedSprite;
                track.type = Image.Type.Sliced;
                track.color = ModernUiTheme.CardDeepColor;
            }

            if (bar.handleRect == null)
                return;

            var handle = bar.handleRect.GetComponent<Image>();
            if (handle != null)
            {
                handle.sprite = ModernUiTheme.RoundedSprite;
                handle.type = Image.Type.Sliced;
                handle.color = ModernUiTheme.AccentColor;
            }
        }

        private static Transform FindDeep(Transform root, string name)
        {
            if (root.name == name)
                return root;

            for (var i = 0; i < root.childCount; i++)
            {
                var found = FindDeep(root.GetChild(i), name);
                if (found != null)
                    return found;
            }

            return null;
        }

        private static void SkinOptions(OptionsWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Gear);
            ModernUiTheme.AttachShadow((RectTransform)win.transform);
            ModernUiTheme.StyleTabBar(win.TabButtons);
            ModernUiTheme.RecolorLightTexts(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);
            StyleSliders(win.transform);

            Debug.Log("[ModernPanelSkins] Retinted the options window.");
        }

        private static void SkinEmotes(EmoteWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Smile);
            ModernUiTheme.AttachShadow((RectTransform)win.transform);

            //emote entries are cloned from this one, so tinting it covers them all
            if (win.EntryTemplate != null)
                ModernUiTheme.RecolorLightTexts(win.EntryTemplate.transform);
            if (win.ContentArea != null)
                ModernUiTheme.RecolorLightTexts(win.ContentArea.transform);

            ModernUiTheme.RecolorLightTexts(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);

            Debug.Log("[ModernPanelSkins] Retinted the emote window.");
        }

        /// <summary>
        /// Gives every other window the same panel colour, dark ink and blue accents.
        /// Nothing here moves a single element, it only recolours, so a window this pass
        /// has never been tried against still lays out exactly as it always did.
        /// </summary>
        private void SweepRemainingWindows(UiManager ui)
        {
            var container = ui.PrimaryUserWindowContainer;
            if (container == null)
                return;

            var containerRect = container.rect;

            for (var i = 0; i < container.childCount; i++)
            {
                var child = container.GetChild(i) as RectTransform;
                if (child == null || ModernUiTheme.IsSkinned(child.gameObject))
                    continue;

                var window = child.GetComponent<WindowBase>();
                if (window == null || HasOwnSkin(ui, window))
                    continue;

                //a panel that fills the container is a backdrop rather than a window,
                //and painting it would wash out whatever it is standing behind
                if (child.rect.width >= containerRect.width * 0.95f &&
                    child.rect.height >= containerRect.height * 0.95f)
                    continue;

                ModernUiTheme.MarkSkinned(child.gameObject);
                ModernUiTheme.ApplyWindowChrome(window);

                var background = child.GetComponent<Image>();
                if (background != null && background.color.a > 0.5f)
                    ModernUiTheme.AttachShadow(child);

                ModernUiTheme.RecolorLightTexts(child);
                ModernUiTheme.RecolorAccents(child);

                Debug.Log($"[ModernPanelSkins] Retinted {child.name}.");
            }
        }

        /// <summary>
        /// The windows rebuilt or retinted by name elsewhere. Which component runs first
        /// is not something Unity promises, so the general pass checks rather than
        /// relying on having been beaten to them.
        /// </summary>
        private bool HasOwnSkin(UiManager ui, WindowBase window)
        {
            return window == ui.StatusWindow
                   || window == ui.EquipmentWindow
                   || window == ui.InventoryWindow
                   || window == ui.SkillManager
                   || window == ui.ConfigManager
                   || (emoteWindow != null && window == emoteWindow);
        }

        /// <summary>
        /// Options is mostly sliders, and the reference draws them as a thin blue track
        /// with a round handle rather than the boxy default.
        /// </summary>
        private static void StyleSliders(Transform root)
        {
            foreach (var slider in root.GetComponentsInChildren<Slider>(true))
            {
                if (slider.fillRect != null)
                {
                    var fill = slider.fillRect.GetComponent<Image>();
                    if (fill != null)
                    {
                        fill.sprite = ModernUiTheme.RoundedSprite;
                        fill.type = Image.Type.Sliced;
                        fill.color = ModernUiTheme.AccentColor;
                    }
                }

                if (slider.handleRect != null)
                {
                    var handle = slider.handleRect.GetComponent<Image>();
                    if (handle != null)
                    {
                        handle.sprite = ModernUiTheme.RoundedSprite;
                        handle.type = Image.Type.Sliced;
                        handle.color = ModernUiTheme.AccentColor;
                    }
                }

                //the track sits behind both of those, on the slider itself
                var track = slider.GetComponent<Image>();
                if (track != null)
                {
                    track.sprite = ModernUiTheme.RoundedSprite;
                    track.type = Image.Type.Sliced;
                    track.color = ModernUiTheme.CardDeepColor;
                }
            }
        }
    }
}
