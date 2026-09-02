using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Inventory
{
    /// <summary>
    /// Rebuilds the bag: the grid on the left, a rail of tabs down the right, and a
    /// footer carrying the weight as a bar rather than as a number in brackets.
    ///
    /// The tabs are new buttons calling the window's own ClickTabButton, and the strip
    /// the prefab came with is switched off. That is not for looks: ClickTabButton sets
    /// the position of each of the original buttons itself, sliding the selected one out
    /// by six points, so any layout given to them is overwritten on the next click. The
    /// window's own buttons stay alive and hidden, so everything that method touches is
    /// still there to touch.
    ///
    /// Nothing that carries or receives a drag is moved: the drop zone, the entry
    /// template and the entries themselves stay exactly where the window puts them, and
    /// the grid is laid out by a flexible GridLayoutGroup, so its columns follow whatever
    /// width the view is given without the window needing to know.
    /// </summary>
    public class ModernInventorySkin : MonoBehaviour
    {
        private const float WindowWidth = 640f;
        private const float WindowHeight = 470f;
        private const float Margin = 14f;

        private const float BarHeight = 52f;
        private const float BodyTop = 88f;    //below the header and the count line

        private const float RailWidth = 150f;
        private const float RailGap = 10f;
        private const float TabHeight = 52f;
        private const float TabGap = 8f;

        private const float FooterHeight = 56f;
        private const float CartWidth = 130f;

        private const float SearchInterval = 0.5f;

        private static readonly string[] TabLabels = { "Items", "Equip", "Etc" };

        private static Sprite[] TabIcons => new[]
        {
            ModernUiIcons.Heart, ModernUiIcons.Sword, ModernUiIcons.Star
        };

        private float searchTimer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.SkinsEnabled)
                return;

            if (FindFirstObjectByType<ModernInventorySkin>() != null)
                return;

            var host = new GameObject("ModernInventorySkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernInventorySkin>();
        }

        private void Update()
        {
            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            var ui = UiManager.Instance;
            if (ui == null || ui.InventoryWindow == null)
                return;

            if (ModernUiTheme.IsSkinned(ui.InventoryWindow.gameObject))
            {
                //An entry is made when an item arrives and thrown away when the last of it
                //is used, so unlike everything else in this window the entries cannot be
                //settled once at skin time and are swept while the bag is open.
                if (ui.InventoryWindow.gameObject.activeInHierarchy)
                    RefreshEntries(ui.InventoryWindow);
                return;
            }

            Skin(ui.InventoryWindow);
        }

        /// <summary>
        /// Brings the entries on screen up to the theme. Runs on a timer because entries
        /// come and go with the items in them.
        /// </summary>
        private static void RefreshEntries(PlayerInventoryWindow win)
        {
            if (win.ItemBoxRoot == null)
                return;

            RebuildStackCounts(win.ItemBoxRoot);
            ModernUiTheme.RepaintInk(win.ItemBoxRoot);
        }

        /// <summary>
        /// Points an entry back at its stack count when the reference has gone.
        ///
        /// An earlier version of this pass reached into the prefab asset entries are cloned
        /// from, which the engine will not let a scene object be parented into: the original
        /// label ended up switched off and the reference to it lost, and every entry cloned
        /// afterwards came out of the template that way. That pass is gone, but a project
        /// whose template was damaged while it was still there would otherwise stay broken
        /// until someone noticed the file was modified, so the label is found again here.
        ///
        /// There is exactly one label on an entry, so the first one found is it.
        /// </summary>
        private static bool RecoverCountLabel(DragItemBase item)
        {
            var labels = item.GetComponentsInChildren<TextMeshProUGUI>(true);
            if (labels.Length == 0)
                return false;

            var label = labels[0];

            //switched on because the damage switched it off; what it should actually say and
            //whether it should show at all is written by the window on its next refresh
            label.gameObject.SetActive(true);
            item.CountText = label;
            return true;
        }

        /// <summary>
        /// Draws the number in the corner of each item icon again, in the theme's own
        /// material.
        ///
        /// It arrives as black type inside a thick white halo, which is how the original
        /// client made it readable against a dark tray. On a pale one the halo is just a
        /// smear around every digit. Taking it off the material it came in was not enough
        /// to reach these, so the label is built fresh instead, the way the character
        /// readout in the corner of the screen had to be.
        ///
        /// Live entries only. The template they are cloned from is a prefab asset, not an
        /// object in the scene, and rebuilding a label inside one of those is not a thing
        /// that works: the engine refuses to reparent a scene object into an asset, so the
        /// replacement is left orphaned while the original has already been switched off,
        /// and every entry cloned afterwards comes out with no number on it at all. That is
        /// exactly what happened. The scene test below is what makes it impossible rather
        /// than merely not done.
        /// </summary>
        private static void RebuildStackCounts(Transform root)
        {
            if (root == null || ModernUiTheme.ThemeFont == null)
                return;

            foreach (var item in root.GetComponentsInChildren<DragItemBase>(true))
            {
                if (!item.gameObject.scene.IsValid())
                    continue;

                if (item.CountText == null && !RecoverCountLabel(item))
                    continue;

                //already ours: the theme font is the mark, since nothing the client builds
                //is set in it
                if (item.CountText.font == ModernUiTheme.ThemeFont)
                    continue;

                item.CountText = ModernUiTheme.RebuildLabel(item.CountText);

                //the halo was doing some of the work of making a small number stand out
                //against whatever sprite it lands on, and weight is what replaces it
                if (item.CountText != null)
                    item.CountText.fontStyle = FontStyles.Bold;
            }
        }

        private static void Skin(PlayerInventoryWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            root.sizeDelta = new Vector2(WindowWidth, WindowHeight);

            var panel = win.GetComponent<Image>();
            if (panel != null)
            {
                panel.sprite = ModernUiTheme.RoundedSprite;
                panel.type = Image.Type.Sliced;
                panel.color = ModernUiTheme.WindowColor;
            }

            HideOriginalChrome(root);
            HideOriginalTabs(win);

            ModernUiTheme.AddBorder(root, ModernUiTheme.CardBorderColor);
            ModernUiTheme.AttachShadow(root);

            var bar = ModernUiTheme.CreateTitleBar(win, ThaiUiText.Get("Inventory"), null, ModernUiIcons.Bag);
            bar.offsetMin = new Vector2(0, -BarHeight);

            BuildCountLine(win, root);
            LayOutGrid(win);
            BuildTabRail(win, root);
            BuildFooter(win, root);

            //The template is a prefab asset and is deliberately left alone; entries are
            //brought up to the theme once they exist, by the sweep above.
            RefreshEntries(win);

            ModernUiTheme.StyleScrollViews(root);
            ModernUiTheme.RepaintInk(root);
            ModernUiTheme.RecolorAccents(root);
            ModernUiTheme.StyleCloseButtons(root);
            ThaiUiText.Apply(root);

            Debug.Log("[ModernInventorySkin] Rebuilt the bag window.");
        }

        private static void HideOriginalChrome(RectTransform root)
        {
            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                var name = child.name.ToLowerInvariant();

                //the drop zone is what makes this a window items can be dragged into
                if (name.Contains("dropzone"))
                    continue;

                if (name.Contains("dragobject") || name.Contains("closebutton"))
                    child.gameObject.SetActive(false);
            }
        }

        /// <summary>
        /// Switches off the strip the prefab came with. The search walks up from a tab
        /// button by name and only a few levels, because the button sits two deep inside
        /// it and walking blindly to the top would switch off the window itself.
        /// </summary>
        private static void HideOriginalTabs(PlayerInventoryWindow win)
        {
            if (win.UiTabButtons == null || win.UiTabButtons.Length == 0 || win.UiTabButtons[0] == null)
                return;

            var t = win.UiTabButtons[0].transform;
            for (var i = 0; i < 4 && t != null; i++, t = t.parent)
            {
                if (!t.name.ToLowerInvariant().Contains("tabbar"))
                    continue;

                t.gameObject.SetActive(false);
                return;
            }
        }

        private static void BuildCountLine(PlayerInventoryWindow win, RectTransform root)
        {
            if (root.Find("ModernBagCount") != null)
                return;

            var count = ModernUiTheme.CreateText(root, "ModernBagCount", "", ModernUiTheme.SizeBody,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
            ModernUiTheme.Place(count.rectTransform, new Vector2(0, 1),
                new Vector2(Margin + 4f, -(BarHeight + 4f)), new Vector2(300f, 24f));

            win.CountText = count;
        }

        private static void LayOutGrid(PlayerInventoryWindow win)
        {
            if (win.ScrollArea != null)
            {
                var view = (RectTransform)win.ScrollArea.transform;
                view.anchorMin = new Vector2(0, 0);
                view.anchorMax = new Vector2(1, 1);
                view.pivot = new Vector2(0.5f, 0.5f);
                view.offsetMin = new Vector2(Margin, Margin + FooterHeight + 8f);
                view.offsetMax = new Vector2(-(Margin + RailWidth + RailGap), -BodyTop);
            }

            //a sunken tray behind the items, so the grid reads as a container rather than
            //as icons scattered across the panel
            if (win.ViewBoxTransform != null)
            {
                var tray = win.ViewBoxTransform.GetComponent<Image>();
                if (tray != null)
                {
                    tray.sprite = ModernUiTheme.RoundedSprite;
                    tray.type = Image.Type.Sliced;
                    tray.color = ModernUiTheme.CardDeepColor;
                }
            }
        }

        private static void BuildTabRail(PlayerInventoryWindow win, RectTransform root)
        {
            if (root.Find("ModernBagRail") != null)
                return;

            var rail = ModernUiTheme.CreateCard(root, "ModernBagRail", ModernUiTheme.WindowColor, true);
            rail.anchorMin = new Vector2(1, 0);
            rail.anchorMax = new Vector2(1, 1);
            rail.pivot = new Vector2(1, 0.5f);
            rail.offsetMin = new Vector2(-(Margin + RailWidth), Margin + FooterHeight + 8f);
            rail.offsetMax = new Vector2(-Margin, -BodyTop);

            var buttons = new Button[TabLabels.Length];
            var borders = new Image[TabLabels.Length];
            var icons = new Image[TabLabels.Length];
            var glyphs = TabIcons;
            var state = new RailState { Buttons = buttons, Borders = borders, Icons = icons };

            for (var i = 0; i < TabLabels.Length; i++)
            {
                var button = ModernUiTheme.CreateButton(rail, "Tab" + i, ThaiUiText.Get(TabLabels[i]),
                    ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeBody);
                ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 1),
                    new Vector2(10f, -(10f + i * (TabHeight + TabGap))),
                    new Vector2(RailWidth - 20f, TabHeight));

                borders[i] = ModernUiTheme.AddBorder((RectTransform)button.transform,
                    ModernUiTheme.CardBorderColor);

                var icon = ModernUiTheme.CreateIcon(button.transform, glyphs[i], ModernUiTheme.AccentInkColor, 20);
                ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(14f, 0f),
                    new Vector2(20f, 20f));
                icons[i] = icon;

                var label = button.GetComponentInChildren<TextMeshProUGUI>(true);
                if (label != null)
                {
                    label.alignment = TextAlignmentOptions.Left;
                    ModernUiTheme.Stretch(label.rectTransform, 44f, 0f, -10f, 0f);
                }

                var index = i;
                //the window's own method, so the filtering and the refresh are untouched
                button.onClick.AddListener(() =>
                {
                    win.ClickTabButton(index);
                    state.Paint(index);
                });
            }

            //the click handlers close over the state, which is all that has to keep it
            //alive: it goes when the buttons do
            state.Paint(0);
        }

        /// <summary>
        /// Which of the three is filled in. Kept beside the buttons rather than in the
        /// window, which tracks the same thing privately for its own filtering.
        /// </summary>
        private class RailState
        {
            public Button[] Buttons;
            public Image[] Borders;
            public Image[] Icons;

            public void Paint(int active)
            {
                for (var i = 0; i < Buttons.Length; i++)
                {
                    if (Buttons[i] == null)
                        continue;

                    var isActive = i == active;

                    var fill = Buttons[i].GetComponent<Image>();
                    if (fill != null)
                        fill.color = isActive ? ModernUiTheme.AccentColor : ModernUiTheme.CardColor;

                    if (Borders[i] != null)
                        Borders[i].color = isActive ? ModernUiTheme.AccentColor : ModernUiTheme.CardBorderColor;

                    if (Icons[i] != null)
                        Icons[i].color = isActive ? ModernUiTheme.AccentTextColor : ModernUiTheme.AccentInkColor;

                    foreach (var label in Buttons[i].GetComponentsInChildren<TextMeshProUGUI>(true))
                    {
                        label.color = isActive ? ModernUiTheme.AccentTextColor : ModernUiTheme.NameColor;
                        label.fontStyle = FontStyles.Bold;
                    }
                }
            }
        }

        private static void BuildFooter(PlayerInventoryWindow win, RectTransform root)
        {
            var textWidth = WindowWidth - Margin * 2f - CartWidth - 16f;

            if (win.WeightText != null && root.Find("ModernBagWeightTrack") == null)
            {
                var text = win.WeightText.rectTransform;
                text.SetParent(root, false);
                ModernUiTheme.Place(text, new Vector2(0, 0), new Vector2(Margin + 4f, Margin + 26f),
                    new Vector2(textWidth, 24f));

                //This one came from the prefab wearing the outlined material the rest of the
                //game's labels use, and clearing that material was not reaching it. It is
                //drawn again instead, and the window's own reference is moved onto the new
                //label so every weight it writes still lands.
                win.WeightText = ModernUiTheme.RebuildLabel(win.WeightText);

                win.WeightText.color = ModernUiTheme.NameColor;
                win.WeightText.fontSize = ModernUiTheme.SizeBody;
                win.WeightText.alignment = TextAlignmentOptions.Left;
                win.WeightText.fontStyle = FontStyles.Bold;

                //A bar says how full the bag is at a glance, which a percentage in
                //brackets does not. The window drives the fill; it writes nothing when the
                //skin has not given it one, so the plain readout still works on its own.
                var track = ModernUiTheme.CreateCard(root, "ModernBagWeightTrack", ModernUiTheme.CardDeepColor);
                ModernUiTheme.Place(track, new Vector2(0, 0), new Vector2(Margin + 4f, Margin + 12f),
                    new Vector2(textWidth, 10f));
                track.GetComponent<Image>().raycastTarget = false;

                var fillRect = ModernUiTheme.CreateCard(track, "Fill", ModernUiTheme.AccentColor);
                ModernUiTheme.Stretch(fillRect, 0, 0, 0, 0);

                var fill = fillRect.GetComponent<Image>();
                fill.type = Image.Type.Filled;
                fill.fillMethod = Image.FillMethod.Horizontal;
                fill.fillOrigin = 0;
                fill.fillAmount = 0f;
                fill.raycastTarget = false;
                win.WeightFill = fill;
            }

            //ItemCounts is not a container around the readout, it is the readout: the text
            //component sits on that very object, and switching it off while it was still
            //the weight line is what made the footer come up empty. It is safe to hide once
            //the line has been drawn again, since the reference has moved to the new label,
            //and the test still stands for the case where there was nothing to redraw.
            var counts = root.Find("ItemCounts");
            if (counts != null && (win.WeightText == null || counts != win.WeightText.transform))
                counts.gameObject.SetActive(false);

            if (win.CartButton != null)
            {
                ModernUiTheme.Place((RectTransform)win.CartButton.transform, new Vector2(1, 0),
                    new Vector2(-Margin, Margin + 6f), new Vector2(CartWidth, 44f));

                var image = win.CartButton.GetComponent<Image>();
                if (image != null)
                {
                    image.sprite = ModernUiTheme.RoundedSprite;
                    image.type = Image.Type.Sliced;
                    image.color = ModernUiTheme.AccentColor;
                }

                foreach (var label in win.CartButton.GetComponentsInChildren<TextMeshProUGUI>(true))
                {
                    label.color = ModernUiTheme.AccentTextColor;
                    label.fontSize = ModernUiTheme.SizeBody;
                    label.fontStyle = FontStyles.Bold;
                    label.alignment = TextAlignmentOptions.Center;
                    label.extraPadding = true;
                }
            }
        }
    }
}
