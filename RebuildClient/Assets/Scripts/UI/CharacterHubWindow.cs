using System.Collections.Generic;
using Assets.Scripts.UI.Inventory;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// One window holding equipment, stats and skills as tabs, the way a modern client
    /// presents them, over the three separate windows the game shipped with.
    ///
    /// Nothing is rewritten to get there. Each tab is the original window, moved inside
    /// this one and stripped of its own header, so every line of logic those windows
    /// carry still runs untouched and every reference the rest of the client holds to
    /// them still points at the same object.
    ///
    /// The inventory deliberately stays outside. It is the source end of six different
    /// drop targets (equipment, cart, hotbar, storage, an NPC's trade panel, the trash),
    /// and folding it into a tab would mean it could no longer be open at the same time
    /// as the thing being dragged onto. That is the same reason every MMO keeps its bag
    /// separate while a collection game can put everything behind tabs.
    /// </summary>
    public class CharacterHubWindow : WindowBase
    {
        private const float Padding = 14f;
        //the theme's header allows for a subtitle under the title; this window has none,
        //so the bar is cut back to what the title alone needs and the tabs move up
        private const float BarHeight = 52f;
        private const float HeaderHeight = BarHeight + 2f;
        private const float TabHeight = 34f;
        private const float TabGap = 6f;

        private readonly List<WindowBase> pages = new List<WindowBase>();
        private readonly List<Button> tabs = new List<Button>();
        private readonly List<Vector2> pageSizes = new List<Vector2>();

        private RectTransform content;
        private int current;

        public int PageCount => pages.Count;

        public static CharacterHubWindow Create(RectTransform parent)
        {
            //assembled inactive so the tabs can be wired before anything can be clicked
            var go = new GameObject("CharacterHub", typeof(Image));
            go.SetActive(false);
            go.transform.SetParent(parent, false);

            var hub = go.AddComponent<CharacterHubWindow>();
            hub.Build();
            return hub;
        }

        private void Build()
        {
            var root = (RectTransform)transform;
            root.anchorMin = new Vector2(0, 1);
            root.anchorMax = new Vector2(0, 1);
            root.pivot = new Vector2(0, 1);

            var panel = GetComponent<Image>();
            panel.sprite = ModernUiTheme.RoundedSprite;
            panel.type = Image.Type.Sliced;
            panel.color = ModernUiTheme.WindowColor;

            ModernUiTheme.AttachShadow(root);
            ModernUiTheme.AddBorder(root, ModernUiTheme.CardBorderColor);

            var bar = ModernUiTheme.CreateTitleBar(this, ThaiUiText.Get("Character"), null, ModernUiIcons.Person);
            bar.offsetMin = new Vector2(0, -BarHeight);

            content = ModernUiTheme.CreateRect("Pages", root);
            content.anchorMin = new Vector2(0, 0);
            content.anchorMax = new Vector2(1, 1);
            content.offsetMin = new Vector2(Padding, Padding);
            content.offsetMax = new Vector2(-Padding, -(HeaderHeight + TabHeight + TabGap));
        }

        /// <summary>
        /// Takes a window over as a tab. Its size is read before its anchors are changed,
        /// then written back, so the window keeps exactly the dimensions its own layout
        /// was built against and nothing inside it shifts.
        /// </summary>
        public void AddPage(WindowBase window, string label, Sprite icon)
        {
            if (window == null)
                return;

            var rect = (RectTransform)window.transform;
            var size = rect.rect.size;

            //this window decides where the page sits now, and the play area clamp would
            //otherwise drag it back out to screen coordinates the moment it was shown
            window.AutomaticallyFitIntoPlayArea = false;

            rect.SetParent(content, false);
            rect.localScale = Vector3.one;
            rect.anchorMin = new Vector2(0.5f, 1f);
            rect.anchorMax = new Vector2(0.5f, 1f);
            rect.pivot = new Vector2(0.5f, 1f);
            rect.sizeDelta = size;

            //The page's own header is switched off, but the space it occupied is still
            //part of the page. Sliding the page up by exactly that much puts the first
            //real row of content against the tabs instead of leaving a band of nothing
            //there, and takes the same amount off the height this window has to be.
            var trim = StripPageChrome(rect);
            rect.anchoredPosition = new Vector2(0, trim);

            var index = pages.Count;
            pages.Add(window);
            pageSizes.Add(new Vector2(size.x, Mathf.Max(size.y - trim, 120f)));

            var tab = ModernUiTheme.CreateButton(transform, "Tab" + index, label,
                ModernUiTheme.TabIdleColor, ModernUiTheme.NameColor, ModernUiTheme.SizeLabel);
            tabs.Add(tab);
            tab.onClick.AddListener(() => Show(index));

            if (icon != null)
            {
                var glyph = ModernUiTheme.CreateIcon(tab.transform, icon, ModernUiTheme.NameColor, 15);
                ModernUiTheme.Place(glyph.rectTransform, new Vector2(0, 0.5f), new Vector2(10, 0), new Vector2(15, 15));

                var text = tab.GetComponentInChildren<TextMeshProUGUI>(true);
                if (text != null)
                {
                    text.alignment = TextAlignmentOptions.Left;
                    ModernUiTheme.Stretch(text.rectTransform, 30, 0, -6, 0);
                }
            }

            window.gameObject.SetActive(false);
            ResizeTo(0);
        }

        /// <summary>
        /// A page keeps its own drag bar, close button, shadow and border while it is a
        /// window of its own. Inside this one those are duplicates of the header above it,
        /// so they are switched off rather than removed: a page is still a window and
        /// could be given back its own frame later.
        /// </summary>
        /// <summary>
        /// Returns how much dead space the hidden header left at the top of the page.
        /// </summary>
        private static float StripPageChrome(RectTransform page)
        {
            var trim = 0f;

            for (var i = 0; i < page.childCount; i++)
            {
                var child = page.GetChild(i);
                var name = child.name.ToLowerInvariant();

                var isHeader = name.Contains("moderntitlebar") || name.Contains("drag")
                                                               || name.Contains("closebutton");
                var isDecoration = name.Contains("modernshadow") || name.Contains("modernborder")
                                                                 || name.Contains("resizehandle");

                if (!isHeader && !isDecoration)
                    continue;

                child.gameObject.SetActive(false);

                //only a bar pinned across the top of the page is space that can be
                //reclaimed; a resize grip at the bottom leaves nothing behind
                var rect = child as RectTransform;
                if (isHeader && rect != null && rect.anchorMin.y > 0.9f && rect.anchorMax.y > 0.9f)
                    trim = Mathf.Max(trim, rect.rect.height);
            }

            //the page's own panel would sit as a second card inside this window's card
            var background = page.GetComponent<Image>();
            if (background != null)
                background.color = new Color(0f, 0f, 0f, 0f);

            return trim;
        }

        private void LayoutTabs()
        {
            if (tabs.Count == 0)
                return;

            var root = (RectTransform)transform;
            var usable = root.rect.width - Padding * 2f - TabGap * (tabs.Count - 1);
            var width = usable / tabs.Count;

            for (var i = 0; i < tabs.Count; i++)
            {
                var rect = (RectTransform)tabs[i].transform;
                ModernUiTheme.Place(rect, new Vector2(0, 1),
                    new Vector2(Padding + i * (width + TabGap), -HeaderHeight),
                    new Vector2(width, TabHeight));
            }
        }

        /// <summary>
        /// Sizes the window to the page being shown. Sizing it to the largest page instead
        /// kept every tab as tall as the tallest, which put a band of empty panel under the
        /// short ones and pushed the window off the bottom of the screen. The window is
        /// pinned by its top left corner, so growing and shrinking moves only its lower
        /// edge and the tabs stay under the pointer.
        /// </summary>
        private void ResizeTo(int index)
        {
            if (index < 0 || index >= pageSizes.Count)
                return;

            var page = pageSizes[index];
            var width = page.x + Padding * 2f;
            var height = page.y + HeaderHeight + TabHeight + TabGap + Padding;

            //never taller than what it is being drawn into, whatever a page asks for
            var container = transform.parent as RectTransform;
            if (container != null)
            {
                var available = container.rect.height - 24f;
                if (available > 240f)
                    height = Mathf.Min(height, available);
            }

            var root = (RectTransform)transform;
            root.sizeDelta = new Vector2(width, height);

            LayoutTabs();
        }

        public void Show(int index)
        {
            if (index < 0 || index >= pages.Count)
                return;

            current = index;
            ResizeTo(index);

            //Shown and hidden through the window's own methods rather than by switching
            //the object, so that the escape stack stays true. Escape closes whatever is
            //last in that stack, and a page put on screen behind its back was never in
            //it, which is why escape did nothing while this window was open.
            for (var i = 0; i < pages.Count; i++)
            {
                if (pages[i] == null)
                    continue;

                if (i == index)
                {
                    pages[i].ShowWindow();
                    pages[i].MoveToTop();
                }
                else
                {
                    pages[i].HideWindow();
                }
            }

            PaintTabs();

            if (!gameObject.activeSelf)
                gameObject.SetActive(true);

            transform.SetAsLastSibling();
        }

        private void PaintTabs()
        {
            for (var i = 0; i < tabs.Count; i++)
            {
                var active = i == current;
                var image = tabs[i].GetComponent<Image>();
                if (image != null)
                    image.color = active ? ModernUiTheme.AccentColor : ModernUiTheme.TabIdleColor;

                var ink = active ? ModernUiTheme.AccentTextColor : ModernUiTheme.NameColor;
                foreach (var label in tabs[i].GetComponentsInChildren<TextMeshProUGUI>(true))
                {
                    label.color = ink;
                    label.fontStyle = FontStyles.Bold;
                }

                foreach (var glyph in tabs[i].GetComponentsInChildren<Image>(true))
                {
                    if (glyph.transform != tabs[i].transform && glyph.name == "Icon")
                        glyph.color = ink;
                }
            }
        }

        /// <summary>
        /// Which page is switched on is the whole of this window's state, so the hotkeys
        /// and the buttons along the bottom of the screen are left calling ShowWindow on
        /// the old windows exactly as they always did. Reading that rather than
        /// intercepting it means nothing else in the client had to be told this window
        /// exists. Driven from the always-on host, since a hidden window gets no Update.
        /// </summary>
        public void SyncToPages()
        {
            //A page other than the one showing having been switched on is the player
            //asking for that page: pressing the skills key while equipment is up leaves
            //two of them on, and the one that was not already there is the one wanted.
            //Taking the first active page instead would have kept showing equipment.
            var anyActive = -1;
            var newlyActive = -1;

            for (var i = 0; i < pages.Count; i++)
            {
                if (pages[i] == null || !pages[i].gameObject.activeSelf)
                    continue;

                if (anyActive < 0)
                    anyActive = i;

                if (i != current)
                {
                    newlyActive = i;
                    break;
                }
            }

            var target = newlyActive >= 0 ? newlyActive : anyActive;

            if (target < 0)
            {
                if (gameObject.activeSelf)
                    gameObject.SetActive(false);
                return;
            }

            if (target != current || !gameObject.activeSelf)
                Show(target);
        }

        //this window is not in the escape stack: closing it closes its pages, and the
        //pages are what the stack already knows about
        public override void ShowWindow()
        {
            if (pages.Count > 0)
                Show(Mathf.Clamp(current, 0, pages.Count - 1));
        }

        public override void HideWindow()
        {
            CloseWindow();
        }

        public override void CloseWindow()
        {
            //through HideWindow, so the pages come back off the escape stack with them
            foreach (var page in pages)
            {
                if (page != null)
                    page.HideWindow();
            }

            gameObject.SetActive(false);
        }

        public override void MoveToTop()
        {
            transform.SetAsLastSibling();
        }
    }

    /// <summary>
    /// Builds the hub once the windows it is made of exist, then keeps it in step with
    /// them. Lives on its own always-on object because the hub spends most of its life
    /// switched off, and a switched off object cannot watch for the key that opens it.
    /// </summary>
    public class ModernCharacterHub : MonoBehaviour
    {
        private const float SearchInterval = 0.5f;

        private float searchTimer = 2.5f; //let the individual window skins finish first
        private CharacterHubWindow hub;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernCharacterHub>() != null)
                return;

            var host = new GameObject("ModernCharacterHub");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernCharacterHub>();
        }

        private void Update()
        {
            if (hub != null)
            {
                hub.SyncToPages();
                return;
            }

            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            TryBuild();
        }

        private void TryBuild()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return;

            var equipment = ui.EquipmentWindow;
            var stats = ui.StatusWindow;
            var skills = ui.SkillManager;

            if (equipment == null || stats == null || skills == null)
                return;

            //the pages have to have been skinned and sized before they are measured, or
            //the hub is built around whatever the prefab happened to be
            if (!ModernUiTheme.IsSkinned(equipment.gameObject)
                || !ModernUiTheme.IsSkinned(stats.gameObject)
                || !ModernUiTheme.IsSkinned(skills.gameObject))
                return;

            hub = CharacterHubWindow.Create(ui.PrimaryUserWindowContainer);
            hub.AddPage(equipment, ThaiUiText.Get("Equipment"), ModernUiIcons.Armor);
            hub.AddPage(stats, ThaiUiText.Get("Stats"), ModernUiIcons.Person);
            hub.AddPage(skills, ThaiUiText.Get("Skills"), ModernUiIcons.Book);

            hub.CenterWindow();
            hub.CloseWindow();

            Debug.Log($"[ModernCharacterHub] Built the character hub with {hub.PageCount} tabs.");
        }
    }
}
