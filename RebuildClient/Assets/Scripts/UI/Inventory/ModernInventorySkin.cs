using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Inventory
{
    /// <summary>
    /// Rebuilds the bag around the window's own machinery rather than replacing it.
    ///
    /// The item grid is laid out by a flexible GridLayoutGroup, so the columns follow
    /// whatever width the view is given and the window's code, which only ever hands
    /// entries to that group, does not need to know the window changed shape. The tab
    /// strip is laid out by a second one, which is what lets the tabs move from a column
    /// down the left side to a row across the top by resizing a rect.
    ///
    /// Nothing that carries or receives a drag is moved: the drop zone, the entry
    /// template and the entries themselves are left exactly where the window puts them.
    /// </summary>
    public class ModernInventorySkin : MonoBehaviour
    {
        private const float WindowWidth = 520f;
        private const float WindowHeight = 560f;
        private const float Margin = 14f;

        private const float TabTop = 58f;   //below the header band
        private const float TabHeight = 34f;
        private const float TabGap = 6f;

        private const float GridTop = 100f;
        private const float FooterBottom = 14f;
        private const float FooterHeight = 44f;

        private const float SearchInterval = 0.5f;

        private float searchTimer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
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
                return;

            Skin(ui.InventoryWindow);
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

            //the original bar carries the title and the close button; the header built
            //below replaces both, and takes over dragging with them
            HideOriginalChrome(root);

            ModernUiTheme.AddBorder(root, ModernUiTheme.CardBorderColor);
            ModernUiTheme.AttachShadow(root);

            var bar = ModernUiTheme.CreateTitleBar(win, ThaiUiText.Get("Inventory"), null, ModernUiIcons.Bag);
            bar.offsetMin = new Vector2(0, -(TabTop - 6f));

            LayOutTabs(win);
            LayOutGrid(win);
            BuildFooter(win, root);

            //entries are cloned from this one, so the template is styled as well as the
            //entries the window has already built
            if (win.ItemEntryPrefab != null)
                ModernUiTheme.RepaintInk(win.ItemEntryPrefab.transform);
            if (win.ItemBoxRoot != null)
                ModernUiTheme.RepaintInk(win.ItemBoxRoot);

            ModernUiTheme.StyleScrollViews(root);
            ModernUiTheme.RepaintInk(root);
            ModernUiTheme.RecolorAccents(root);
            ThaiUiText.Apply(root);

            Debug.Log("[ModernInventorySkin] Rebuilt the bag window.");
        }

        private static void HideOriginalChrome(RectTransform root)
        {
            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                var name = child.name.ToLowerInvariant();

                //the drop zone is what makes this window a place items can be dragged to,
                //and the entry root is where they live; neither is chrome
                if (name.Contains("dropzone") || name.Contains("content"))
                    continue;

                if (name.Contains("dragobject") || name.Contains("closebutton"))
                    child.gameObject.SetActive(false);
            }
        }

        /// <summary>
        /// Moves the tabs from a column down the left side to a row across the top. They
        /// are positioned by a GridLayoutGroup, so the row is a matter of giving that
        /// group one row to work with and a cell wide enough to divide the window between
        /// however many tabs there turn out to be.
        /// </summary>
        private static void LayOutTabs(PlayerInventoryWindow win)
        {
            if (win.UiTabButtons == null || win.UiTabButtons.Length == 0 || win.UiTabButtons[0] == null)
                return;

            var strip = win.UiTabButtons[0].transform.parent as RectTransform;
            if (strip == null)
                return;

            strip.anchorMin = new Vector2(0, 1);
            strip.anchorMax = new Vector2(1, 1);
            strip.pivot = new Vector2(0.5f, 1);
            strip.offsetMin = new Vector2(Margin, -(TabTop + TabHeight));
            strip.offsetMax = new Vector2(-Margin, -TabTop);

            var count = win.UiTabButtons.Length;
            var grid = strip.GetComponent<GridLayoutGroup>();
            if (grid != null)
            {
                grid.startAxis = GridLayoutGroup.Axis.Horizontal;
                grid.constraint = GridLayoutGroup.Constraint.FixedRowCount;
                grid.constraintCount = 1;
                grid.padding = new RectOffset(0, 0, 0, 0);
                grid.spacing = new Vector2(TabGap, 0);
                grid.cellSize = new Vector2(
                    (WindowWidth - Margin * 2f - TabGap * (count - 1)) / count, TabHeight);
            }

            foreach (var tab in win.UiTabButtons)
            {
                if (tab == null)
                    continue;

                foreach (var label in tab.GetComponentsInChildren<TextMeshProUGUI>(true))
                {
                    label.fontSize = ModernUiTheme.SizeLabel;
                    label.alignment = TextAlignmentOptions.Center;
                    label.extraPadding = true;
                }
            }

            ModernUiTheme.StyleTabBar(win.UiTabButtons);
        }

        private static void LayOutGrid(PlayerInventoryWindow win)
        {
            if (win.ScrollArea != null)
            {
                var view = (RectTransform)win.ScrollArea.transform;
                view.anchorMin = new Vector2(0, 0);
                view.anchorMax = new Vector2(1, 1);
                view.pivot = new Vector2(0.5f, 0.5f);
                view.offsetMin = new Vector2(Margin, FooterBottom + FooterHeight + 8f);
                view.offsetMax = new Vector2(-Margin, -GridTop);
            }

            //a sunken tray behind the items, so the grid reads as a container rather than
            //as icons scattered on the panel
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

        private static void BuildFooter(PlayerInventoryWindow win, RectTransform root)
        {
            if (root.Find("ModernBagFooter") == null)
            {
                var footer = ModernUiTheme.CreateCard(root, "ModernBagFooter", ModernUiTheme.CardColor, true);
                footer.anchorMin = new Vector2(0, 0);
                footer.anchorMax = new Vector2(1, 0);
                footer.pivot = new Vector2(0.5f, 0);
                footer.offsetMin = new Vector2(Margin, FooterBottom);
                footer.offsetMax = new Vector2(-Margin, FooterBottom + FooterHeight);
                footer.GetComponent<Image>().raycastTarget = false;
                footer.SetAsFirstSibling();

                if (win.WeightText != null)
                {
                    var text = win.WeightText.rectTransform;
                    text.SetParent(footer, false);
                    ModernUiTheme.Stretch(text, 14, 0, -14, 0);

                    win.WeightText.color = ModernUiTheme.NameColor;
                    win.WeightText.fontSize = ModernUiTheme.SizeLabel;
                    win.WeightText.alignment = TextAlignmentOptions.Left;
                    win.WeightText.extraPadding = true;
                }
            }

            if (win.CartButton != null)
            {
                var cart = (RectTransform)win.CartButton.transform;
                ModernUiTheme.Place(cart, new Vector2(1, 0), new Vector2(-Margin - 4f, FooterBottom + 6f),
                    new Vector2(96f, FooterHeight - 12f));

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
                    label.fontSize = ModernUiTheme.SizeSmall;
                    label.fontStyle = FontStyles.Bold;
                    label.extraPadding = true;
                }
            }
        }
    }
}
