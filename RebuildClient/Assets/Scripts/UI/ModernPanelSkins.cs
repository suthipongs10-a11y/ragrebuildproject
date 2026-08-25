using Assets.Scripts.UI.ClientDatabase;
using Assets.Scripts.UI.ConfigWindow;
using Assets.Scripts.UI.Hud;
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
        private bool promptsSkinned;

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

            if (ui.SkillManager != null && !ModernUiTheme.IsSkinned(ui.SkillManager.gameObject))
                SkinSkills(ui.SkillManager);

            if (ui.ConfigManager != null && !ModernUiTheme.IsSkinned(ui.ConfigManager.gameObject))
                SkinOptions(ui.ConfigManager);

            //The two boxes that pop up over everything else. Worth naming rather than
            //leaving to the sweep below: one of them is not a WindowBase at all, and the
            //sweep only looks at those. Both are in the scene from the start, so once they
            //have been dressed there is nothing left here to check for the rest of the run.
            if (!promptsSkinned && ui.YesNoOptionsWindow != null && ui.TextInputWindow != null)
            {
                ModernPromptSkin.Skin(ui.YesNoOptionsWindow.gameObject, "ยืนยัน", ModernUiIcons.Alert);
                ModernPromptSkin.Skin(ui.TextInputWindow.gameObject, "กรอกข้อมูล", ModernUiIcons.Pencil);
                promptsSkinned = true;
            }

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

                ModernUiTheme.AddBorder(win.TooltipBox, ModernUiTheme.CardBorderColor);
                ModernUiTheme.AttachShadow(win.TooltipBox, 10f);

                //The tooltip must never take the pointer. It grows to fit the description,
                //and a long one grew far enough to cover the row being hovered: the row
                //lost the pointer, hid the tooltip, got the pointer back, showed it again,
                //once per frame. That loop is what read as flickering, and it only ever
                //happened on the long descriptions because the short ones stayed clear of
                //the cursor.
                foreach (var graphic in win.TooltipBox.GetComponentsInChildren<Graphic>(true))
                    graphic.raycastTarget = false;
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
            StyleSkillFooter(win);

            Debug.Log("[ModernPanelSkins] Retinted the skill window.");
        }

        /// <summary>
        /// Finishes the strip along the bottom of the skill window. With the point count
        /// moved up under the tabs, what was left down here was the lock toggle off to one
        /// side and the resize target, a 120 by 30 image that read as a stray bar lying
        /// across the middle. The strip becomes a proper footer and the resize target
        /// becomes a small grip, without its rect changing, so the drag still works.
        /// </summary>
        private static void StyleSkillFooter(SkillWindow win)
        {
            var root = (RectTransform)win.transform;

            if (root.Find("ModernFooter") == null)
            {
                //measured off the prefab: the lock toggle runs from 2.8 to 28.8 above the
                //bottom edge and the resize target from 4 to 34, so a band from 2 to 38
                //holds both with a little room
                var footer = ModernUiTheme.CreateCard(root, "ModernFooter", ModernUiTheme.CardColor, true);
                footer.anchorMin = new Vector2(0, 0);
                footer.anchorMax = new Vector2(1, 0);
                footer.pivot = new Vector2(0.5f, 0);
                footer.offsetMin = new Vector2(14, 2);
                footer.offsetMax = new Vector2(-14, 38);
                footer.GetComponent<Image>().raycastTarget = false;
                footer.SetAsFirstSibling();
            }

            ModernUiTheme.StyleResizeGrip(root);
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
            SpreadTabs((RectTransform)win.transform, win.TabButtons);
            ModernUiTheme.StyleTabBar(win.TabButtons);
            ModernUiTheme.RepaintInk(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);
            ModernUiTheme.StyleSliders(win.transform);
            ModernUiTheme.StyleScrollViews(win.transform);
            ModernUiTheme.StyleResizeGrip(win.transform);
            ThaiUiText.Apply(win.transform);

            //after the wording is swapped, since it is the Thai that has to fit
            if (win.TabContents != null)
            {
                foreach (var page in win.TabContents)
                {
                    if (page != null)
                        FitLabelsToRows(page.transform);
                }
            }

            Debug.Log("[ModernPanelSkins] Retinted the options window.");
        }

        /// <summary>
        /// Brings each label down to what its own row can hold.
        ///
        /// Thai sets taller than Latin at the same point size: the vowels sit above the
        /// letters and the tone marks above those again. The options rows are twenty
        /// points high and were laid out for English, so the wording that replaced it
        /// grew up into the row above and the two ran together. Sizing from the row rather
        /// than picking one number covers the headings, which have more room, at the same
        /// time.
        /// </summary>
        private static void FitLabelsToRows(Transform root)
        {
            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                var height = text.rectTransform.rect.height;
                if (height <= 1f)
                    continue;

                //a shade under two thirds of the row leaves room for what Thai puts above
                //and below the line without the text touching the row on either side
                text.fontSize = Mathf.Clamp(height * 0.62f, 10f, ModernUiTheme.SizeBody);
            }
        }

        /// <summary>
        /// Divides the tab strip evenly between the tabs that are actually showing.
        ///
        /// The strip is laid out by a group with a cell size written for the wording it
        /// originally had, so the filled tab was wider than the tab it was filling and the
        /// row packed to the left with a gap along the right. Sizing the cell from the
        /// window and from how many tabs are switched on gets both right at once, and
        /// keeps working when a tab is hidden.
        /// </summary>
        private static void SpreadTabs(RectTransform window, System.Collections.Generic.IList<Button> tabs)
        {
            if (tabs == null || tabs.Count == 0 || tabs[0] == null)
                return;

            var strip = tabs[0].transform.parent as RectTransform;
            if (strip == null)
                return;

            var visible = 0;
            foreach (var tab in tabs)
            {
                if (tab != null && tab.gameObject.activeSelf)
                    visible++;
            }

            if (visible == 0)
                return;

            const float gap = 6f;
            const float inset = 10f;
            var width = window.rect.width - inset * 2f;

            //only the horizontal offsets are touched; the strip's own height and where it
            //sits under the header are the window's business
            strip.offsetMin = new Vector2(inset, strip.offsetMin.y);
            strip.offsetMax = new Vector2(-inset, strip.offsetMax.y);

            var grid = strip.GetComponent<GridLayoutGroup>();
            if (grid != null)
            {
                grid.startAxis = GridLayoutGroup.Axis.Horizontal;
                grid.constraint = GridLayoutGroup.Constraint.FixedRowCount;
                grid.constraintCount = 1;
                grid.padding = new RectOffset(0, 0, 0, 0);
                grid.spacing = new Vector2(gap, 0);
                grid.cellSize = new Vector2((width - gap * (visible - 1)) / visible, grid.cellSize.y);
                return;
            }

            var row = strip.GetComponent<HorizontalLayoutGroup>();
            if (row == null)
                return;

            row.padding = new RectOffset(0, 0, 0, 0);
            row.spacing = gap;
            row.childForceExpandWidth = true;
            row.childControlWidth = true;
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
                                                || window is ClientDatabaseWindow || window is DialogWindow
                                                || window is CharacterHubWindow)
                return true;

            if (window == ui.YesNoOptionsWindow)
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
