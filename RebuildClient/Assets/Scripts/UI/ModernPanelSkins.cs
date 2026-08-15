using Assets.Scripts.UI.ClientDatabase;
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
        private const float TranslateInterval = 3f;

        private EmoteWindow emoteWindow;
        private float translateTimer;

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

            //the bar along the bottom and the rest of the heads up display are built by
            //the scene rather than by a window, so the wording is swapped on its own
            //slower beat: buttons can appear at any point during a session
            translateTimer -= Time.deltaTime;
            if (translateTimer <= 0)
            {
                translateTimer = TranslateInterval;
                if (ui.PrimaryUserUIContainer != null)
                    ThaiUiText.ApplyToControls(ui.PrimaryUserUIContainer.transform);
            }

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
                ModernUiTheme.RepaintInk(win.ItemEntryPrefab.transform);
            if (win.ItemBoxRoot != null)
                ModernUiTheme.RepaintInk(win.ItemBoxRoot);

            ModernUiTheme.StyleScrollViews(win.transform);
            ModernUiTheme.RepaintInk(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);
            ThaiUiText.Apply(win.transform);

            Debug.Log("[ModernPanelSkins] Retinted the inventory window.");
        }

        private static void SkinSkills(SkillWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Book);

            //a skill row lays its name, its level and its cost out across 500 points of
            //width, so at the original 430 the last two columns fell off the right and the
            //window grew a sideways scrollbar to reach them
            var root = (RectTransform)win.transform;
            root.sizeDelta = new Vector2(Mathf.Max(root.sizeDelta.x, 580f), Mathf.Max(root.sizeDelta.y, 600f));

            //with the row fitting, there is nothing left to scroll sideways to, and the
            //bar was only ever taking a strip out of the bottom of the window
            var horizontal = FindDeep(win.transform, "Scrollbar Horizontal");
            if (horizontal != null)
                horizontal.gameObject.SetActive(false);

            ModernUiTheme.StyleScrollViews(win.transform);

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

            ModernUiTheme.RepaintInk(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);

            ThaiUiText.Apply(win.transform);

            //after the sweeps, so nothing repaints the number the window is here for
            StylePointsReadout(win);

            Debug.Log("[ModernPanelSkins] Retinted the skill window.");
        }

        /// <summary>
        /// Moves the skill point count out of the strip along the bottom of the window and
        /// into a band of its own under the tabs, the way the stats window reads.
        ///
        /// In the original layout it is a 145 point box pinned to the bottom right corner,
        /// sharing that strip with the lock toggle and sitting directly under the sideways
        /// scrollbar. It is the one number the window exists to tell you, and down there it
        /// was never once seen. The window keeps writing into the same component, so
        /// nothing about how the count is produced changes.
        /// </summary>
        private static void StylePointsReadout(SkillWindow win)
        {
            var points = win.PointsText;
            if (points == null)
                return;

            var root = (RectTransform)win.transform;
            if (root.Find("ModernPointsCard") != null)
                return;

            //the tabs run from 35 to 61 below the top of the window, so the band goes in
            //just under them and the list is pushed down far enough to clear it
            const float bandTop = -68f;
            const float bandBottom = -104f;

            var scroll = win.GetComponentInChildren<ScrollRect>(true);
            if (scroll != null)
            {
                var view = (RectTransform)scroll.transform;
                view.offsetMax = new Vector2(view.offsetMax.x, bandBottom - 6f);
            }

            var card = ModernUiTheme.CreateCard(root, "ModernPointsCard", ModernUiTheme.CardDeepColor, true);
            card.anchorMin = new Vector2(0, 1);
            card.anchorMax = new Vector2(1, 1);
            card.pivot = new Vector2(0.5f, 1);
            card.offsetMin = new Vector2(14, bandBottom);
            card.offsetMax = new Vector2(-14, bandTop);
            card.GetComponent<Image>().raycastTarget = false;

            var icon = ModernUiTheme.CreateIcon(card, ModernUiIcons.Spark, ModernUiTheme.AccentColor, 18);
            ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(12, 0), new Vector2(18, 18));

            var rect = points.rectTransform;
            rect.SetParent(card, false);
            ModernUiTheme.Stretch(rect, 38, 0, -14, 0);

            points.color = ModernUiTheme.TitleColor;
            points.fontStyle = FontStyles.Bold;
            points.fontSize = ModernUiTheme.SizeValue;
            points.alignment = TextAlignmentOptions.Left;
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
            ModernUiTheme.RepaintInk(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);
            ModernUiTheme.StyleSliders(win.transform);
            ModernUiTheme.StyleScrollViews(win.transform);
            ThaiUiText.Apply(win.transform);

            Debug.Log("[ModernPanelSkins] Retinted the options window.");
        }

        private static void SkinEmotes(EmoteWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Smile);
            ModernUiTheme.AttachShadow((RectTransform)win.transform);

            //emote entries are cloned from this one, so tinting it covers them all
            if (win.EntryTemplate != null)
                ModernUiTheme.RepaintInk(win.EntryTemplate.transform);
            if (win.ContentArea != null)
                ModernUiTheme.RepaintInk(win.ContentArea.transform);

            ModernUiTheme.RepaintInk(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);
            ThaiUiText.Apply(win.transform);

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

                ModernUiTheme.StyleScrollViews(child);
                ModernUiTheme.StyleSliders(child);
                ModernUiTheme.RepaintInk(child);
                ModernUiTheme.RecolorAccents(child);
                ThaiUiText.Apply(child);

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
            //matched by type where there is more than one of a window alive at once: the
            //item description card exists twice over, one for the item under the cursor
            //and one for whatever it is being compared against
            if (window is ItemDescriptionWindow || window is CardIllustrationWindow
                                                || window is ClientDatabaseWindow || window is DialogWindow)
                return true;

            return window == ui.StatusWindow
                   || window == ui.EquipmentWindow
                   || window == ui.InventoryWindow
                   || window == ui.SkillManager
                   || window == ui.ConfigManager
                   || (emoteWindow != null && window == emoteWindow);
        }

    }
}
