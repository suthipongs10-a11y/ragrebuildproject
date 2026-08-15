using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// Folds the row of ten window buttons along the bottom of the screen into four.
    ///
    /// Ten of them was a list of every window the client has, in the order they were
    /// written, and most of them are opened once a session. Three get pulled out because
    /// they are the ones reached constantly, and everything else goes behind a menu. That
    /// is worth doing on a desktop and it is the difference between usable and not on a
    /// phone, where those ten buttons were most of the bottom of the screen.
    ///
    /// The original buttons are not replaced, only hidden. Each new tile fires the click
    /// of the one it stands for, so whatever those buttons were wired to in the scene is
    /// still what happens, and nothing here needs to know what that was.
    /// </summary>
    public class ModernDockBar : MonoBehaviour
    {
        private const string ZoneName = "BottomRIghtZone";
        private const float SearchInterval = 0.5f;

        private const float TileWidth = 86f;
        private const float TileGap = 6f;
        private const float MenuWidth = 190f;
        private const float MenuRow = 38f;
        private const float MenuPad = 8f;

        /// <summary>
        /// The three kept out in front, by the name of the button in the scene, and the
        /// icon and label each one takes.
        /// </summary>
        private static readonly (string Button, string Label, System.Func<Sprite> Icon)[] Primary =
        {
            ("Equipment", "Character", () => ModernUiIcons.Person),
            ("Inventory", "Inventory", () => ModernUiIcons.Bag),
            ("Warps", "Map", () => ModernUiIcons.Target),
        };

        /// <summary>Everything else, in the order it reads best rather than scene order.</summary>
        private static readonly (string Button, string Label, System.Func<Sprite> Icon)[] Secondary =
        {
            ("Stats", "Stats", () => ModernUiIcons.Star),
            ("Skills", "Skills", () => ModernUiIcons.Book),
            ("Hotbar", "Hotbar", () => ModernUiIcons.Grid),
            ("Emotes", "Emotes", () => ModernUiIcons.Smile),
            ("Config", "Config", () => ModernUiIcons.Gear),
            ("Help", "Help", () => ModernUiIcons.Book),
            ("Database", "Database", () => ModernUiIcons.Magnifier),
        };

        private float searchTimer;
        private RectTransform menuPanel;
        private GameObject clickCatcher;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernDockBar>() != null)
                return;

            var host = new GameObject("ModernDockBar");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernDockBar>();
        }

        private void Update()
        {
            if (menuPanel != null)
                return;

            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            var zone = GameObject.Find(ZoneName);
            if (zone == null || ModernUiTheme.IsSkinned(zone))
                return;

            Build(zone);
        }

        private void Build(GameObject zone)
        {
            ModernUiTheme.MarkSkinned(zone);

            var buttons = new Dictionary<string, Button>();
            foreach (var button in zone.GetComponentsInChildren<Button>(true))
                buttons[button.name] = button;

            var root = (RectTransform)zone.transform;

            //the scene lays the ten buttons out in a row for itself; the four that
            //replace them are placed by hand, so that has to stop first
            var layout = zone.GetComponent<HorizontalLayoutGroup>();
            if (layout != null)
                layout.enabled = false;

            foreach (var button in buttons.Values)
                button.gameObject.SetActive(false);

            var bar = ModernUiTheme.CreateCard(root, "ModernDock", ModernUiTheme.WindowColor, true);
            var count = Primary.Length + 1;
            var width = count * TileWidth + (count - 1) * TileGap + 16f;
            ModernUiTheme.Place(bar, new Vector2(1, 0), new Vector2(-8f, 0f), new Vector2(width, 50f));
            ModernUiTheme.AttachShadow(bar, 10f);

            for (var i = 0; i < Primary.Length; i++)
            {
                var entry = Primary[i];
                buttons.TryGetValue(entry.Button, out var target);
                var tile = BuildTile(bar, entry.Label, entry.Icon(), i);
                if (target != null)
                    tile.onClick.AddListener(target.onClick.Invoke);
            }

            var menuTile = BuildTile(bar, "Menu", ModernUiIcons.Grid, Primary.Length);
            menuTile.onClick.AddListener(ToggleMenu);

            BuildMenu(root, buttons);

            Debug.Log($"[ModernDockBar] Folded {buttons.Count} window buttons into {count} tiles.");
        }

        /// <summary>One tile: its icon over its name, which is what makes it tappable.</summary>
        private static Button BuildTile(RectTransform bar, string label, Sprite icon, int index)
        {
            var button = ModernUiTheme.CreateButton(bar, "Tile" + label, "", ModernUiTheme.CardColor,
                ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);

            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 0.5f),
                new Vector2(8f + index * (TileWidth + TileGap), 0f), new Vector2(TileWidth, 40f));

            var glyph = ModernUiTheme.CreateIcon(button.transform, icon, ModernUiTheme.AccentInkColor, 16);
            ModernUiTheme.Place(glyph.rectTransform, new Vector2(0.5f, 1f), new Vector2(0f, -3f),
                new Vector2(16f, 16f));

            var text = button.GetComponentInChildren<TextMeshProUGUI>(true);
            if (text != null)
            {
                text.text = ThaiUiText.Get(label);
                text.alignment = TextAlignmentOptions.Center;
                text.fontSize = ModernUiTheme.SizeSmall;
                ModernUiTheme.Stretch(text.rectTransform, 2f, 2f, -2f, -21f);
            }

            return button;
        }

        /// <summary>
        /// The drawer of everything that did not earn a tile, built once and shown or
        /// hidden. It sits above the bar rather than below it because the bar is already
        /// at the bottom of the screen.
        /// </summary>
        private void BuildMenu(RectTransform root, IReadOnlyDictionary<string, Button> buttons)
        {
            //a full screen transparent sheet under the drawer, so that clicking anywhere
            //else puts it away. Without one the only way to close it is the tile again.
            clickCatcher = new GameObject("ModernDockCatcher", typeof(Image), typeof(Button));
            clickCatcher.transform.SetParent(root, false);
            var catcherImage = clickCatcher.GetComponent<Image>();
            catcherImage.color = new Color(0, 0, 0, 0);
            catcherImage.raycastTarget = true;

            var catcherRect = (RectTransform)clickCatcher.transform;
            catcherRect.anchorMin = new Vector2(0.5f, 0.5f);
            catcherRect.anchorMax = new Vector2(0.5f, 0.5f);
            catcherRect.pivot = new Vector2(0.5f, 0.5f);
            catcherRect.sizeDelta = new Vector2(4000f, 4000f);
            clickCatcher.GetComponent<Button>().onClick.AddListener(CloseMenu);
            clickCatcher.SetActive(false);

            var rows = Secondary.Length;
            var height = rows * MenuRow + (rows - 1) * 4f + MenuPad * 2f;

            menuPanel = ModernUiTheme.CreateCard(root, "ModernDockMenu", ModernUiTheme.WindowColor, true);
            ModernUiTheme.Place(menuPanel, new Vector2(1, 0), new Vector2(-8f, 58f),
                new Vector2(MenuWidth, height));
            ModernUiTheme.AttachShadow(menuPanel, 12f);

            for (var i = 0; i < rows; i++)
            {
                var entry = Secondary[i];
                buttons.TryGetValue(entry.Button, out var target);

                var row = ModernUiTheme.CreateIconButton(menuPanel, "Row" + entry.Button,
                    ThaiUiText.Get(entry.Label), entry.Icon(), ModernUiTheme.CardColor,
                    ModernUiTheme.NameColor, ModernUiTheme.SizeLabel);
                ModernUiTheme.Place((RectTransform)row.transform, new Vector2(0, 1),
                    new Vector2(MenuPad, -(MenuPad + i * (MenuRow + 4f))),
                    new Vector2(MenuWidth - MenuPad * 2f, MenuRow));

                if (target != null)
                    row.onClick.AddListener(target.onClick.Invoke);
                //picking something is also finishing with the drawer
                row.onClick.AddListener(CloseMenu);
            }

            menuPanel.gameObject.SetActive(false);
        }

        private void ToggleMenu()
        {
            if (menuPanel == null)
                return;

            var open = !menuPanel.gameObject.activeSelf;
            menuPanel.gameObject.SetActive(open);
            clickCatcher.SetActive(open);

            if (!open)
                return;

            //in front of the sheet that closes it, and in front of whatever else the
            //bottom of the screen is holding
            clickCatcher.transform.SetAsLastSibling();
            menuPanel.SetAsLastSibling();
        }

        private void CloseMenu()
        {
            if (menuPanel == null)
                return;

            menuPanel.gameObject.SetActive(false);
            clickCatcher.SetActive(false);
        }
    }
}
