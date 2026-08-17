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
        /// Narrow enough that the label under the icon is still readable. Below this the
        /// tiles stop shrinking and the bar is simply pushed to whatever fits, which on a
        /// phone held upright is still better than four tiles that run off the edge.
        /// </summary>
        private const float MinTileWidth = 58f;

        /// <summary>How far off the edge of the screen anything is allowed to sit.</summary>
        private const float ScreenMargin = 6f;

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
        private RectTransform dockBar;
        private RectTransform canvasRect;

        /// <summary>
        /// The zone the bar stands in for, kept only so the bar goes wherever it goes.
        ///
        /// Whether the interface is on screen at all is not its to answer - see LateUpdate -
        /// but it is still the row of buttons this replaces, so anything that hides it by
        /// deactivating it should hide this too.
        /// </summary>
        private GameObject zoneObject;
        private float tileWidth = TileWidth;
        private bool loggedOnce;
        private readonly Vector3[] corners = new Vector3[4];

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

        /// <summary>
        /// Pushes the bar and the drawer back inside the screen.
        ///
        /// Both are placed against the bottom right corner of a zone the game's own
        /// interface owns, and that zone's corner is not the screen's corner at every shape
        /// of screen: on a phone held upright it sits outside, taking the last tile and the
        /// whole drawer with it. Rather than work out which of the layout, the scale and the
        /// aspect is responsible, the answer is measured after the fact - where the thing
        /// actually ended up against where the canvas actually is - which is right whatever
        /// the cause and stays right when the window is resized.
        /// </summary>
        private void LateUpdate()
        {
            if (canvasRect == null)
            {
                if (!loggedOnce && dockBar != null)
                {
                    loggedOnce = true;
                    Debug.LogWarning("[ModernDockBar] No canvas was found above the zone, so nothing is "
                                     + "keeping the bar on screen.");
                }

                return;
            }

            //Follows the interface it belongs to on and off screen.
            //
            //Asking the zone whether it is active was wrong: the title screen does not switch
            //the in game interface off, it disables the Canvas component above it, which
            //leaves every object under it active and simply stops drawing them. That used to
            //take the bar with it, and stopped doing so the moment the bar was hung on the
            //canvas root instead - a different canvas, and one that is never disabled. So the
            //question is asked of the thing that actually answers it.
            var ui = UiManager.Instance;
            var onScreen = ui != null && ui.IsCanvasVisible
                           && zoneObject != null && zoneObject.activeInHierarchy;
            if (dockBar != null && dockBar.gameObject.activeSelf != onScreen)
            {
                dockBar.gameObject.SetActive(onScreen);
                if (!onScreen)
                    CloseMenu();
            }

            if (!onScreen)
                return;

            ReportOnce();
            ClampIntoCanvas(dockBar);
            if (menuPanel != null && menuPanel.gameObject.activeSelf)
                ClampIntoCanvas(menuPanel);
        }

        private void ClampIntoCanvas(RectTransform rect)
        {
            if (rect == null)
                return;

            rect.GetWorldCorners(corners);
            var min = (Vector2)canvasRect.InverseTransformPoint(corners[0]);
            var max = (Vector2)canvasRect.InverseTransformPoint(corners[2]);

            var bounds = canvasRect.rect;
            var limitMin = new Vector2(bounds.xMin + ScreenMargin, bounds.yMin + ScreenMargin);
            var limitMax = new Vector2(bounds.xMax - ScreenMargin, bounds.yMax - ScreenMargin);

            var shift = Vector2.zero;
            //the far edges first, then the near ones, so something taller or wider than the
            //screen ends up showing its top left rather than being pinned by its bottom right
            if (max.x > limitMax.x) shift.x = limitMax.x - max.x;
            if (min.x + shift.x < limitMin.x) shift.x = limitMin.x - min.x;
            if (max.y > limitMax.y) shift.y = limitMax.y - max.y;
            if (min.y + shift.y < limitMin.y) shift.y = limitMin.y - min.y;

            if (shift.sqrMagnitude < 0.01f)
                return;

            //the shift was worked out in the canvas's space; anchoredPosition is in the
            //parent's, and the two are only the same number while the scales match
            var parent = rect.parent as RectTransform;
            var k = parent != null && Mathf.Abs(parent.lossyScale.x) > 0.0001f
                ? canvasRect.lossyScale.x / parent.lossyScale.x
                : 1f;

            rect.anchoredPosition += shift * k;
        }

        /// <summary>
        /// Says once what the bar is actually being measured against.
        ///
        /// The bar fits or it does not, and from a screenshot the two look the same as a
        /// clamp that never ran, a canvas that is wider than the picture, and a screen
        /// reported in different units than the one being looked at. This prints all four
        /// numbers so the next guess is not a guess.
        /// </summary>
        private void ReportOnce()
        {
            if (loggedOnce || dockBar == null)
                return;
            loggedOnce = true;

            dockBar.GetWorldCorners(corners);
            var min = (Vector2)canvasRect.InverseTransformPoint(corners[0]);
            var max = (Vector2)canvasRect.InverseTransformPoint(corners[2]);
            var bounds = canvasRect.rect;

            Debug.Log($"[ModernDockBar] screen {Screen.width}x{Screen.height}, "
                      + $"canvas {bounds.width:0}x{bounds.height:0} "
                      + $"(x {bounds.xMin:0} to {bounds.xMax:0}), "
                      + $"tile {tileWidth:0}, bar x {min.x:0} to {max.x:0}, y {min.y:0} to {max.y:0}. "
                      + $"Overhang right {max.x - (bounds.xMax - ScreenMargin):0}, "
                      + $"canvas scale {canvasRect.lossyScale.x:0.000}, "
                      + $"parent scale {(dockBar.parent as RectTransform)?.lossyScale.x ?? -1f:0.000}");
        }

        /// <summary>The rect everything has to stay inside, which is the canvas, not the zone.</summary>
        private static RectTransform CanvasOf(GameObject zone)
        {
            var canvas = zone.GetComponentInParent<Canvas>();
            if (canvas == null)
                return null;

            var root = canvas.rootCanvas != null ? canvas.rootCanvas : canvas;
            return root.transform as RectTransform;
        }

        private void Build(GameObject zone)
        {
            ModernUiTheme.MarkSkinned(zone);
            zoneObject = zone;

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

            canvasRect = CanvasOf(zone);

            //Hung on the canvas itself, not on the zone it replaces.
            //
            //The zone is a scene object laid out for a wide window, and on a phone held
            //upright its bottom right corner is not the screen's bottom right corner. Three
            //attempts at measuring the difference and correcting for it all worked on a
            //desktop and none of them worked on a phone, and with no console on a phone
            //there was no way to see which of the zone's rect, its layout group, or its
            //scale was doing it. So the zone stops being involved: anchored to the corner of
            //the canvas, the bar is where the corner of the screen is, and none of those
            //three can move it.
            var host = canvasRect != null ? canvasRect : root;

            var bar = ModernUiTheme.CreateCard(host, "ModernDock", ModernUiTheme.WindowColor, true);
            dockBar = bar;

            //The tiles are sized to what there is room for rather than to a number picked on
            //a desktop. The canvas scaler runs at a constant pixel size, so its width in
            //layout units is the screen's pixels divided by the interface scale - on a phone
            //held upright that is around four hundred, and four tiles at the desktop size
            //come to three hundred and seventy eight before the margins. Which is how the
            //last tile ended up past the edge of the screen.
            var count = Primary.Length + 1;
            tileWidth = TileWidth;
            if (canvasRect != null)
            {
                var room = canvasRect.rect.width - ScreenMargin * 2f - 16f - (count - 1) * TileGap;
                tileWidth = Mathf.Clamp(room / count, MinTileWidth, TileWidth);
            }

            var width = count * tileWidth + (count - 1) * TileGap + 16f;
            ModernUiTheme.Place(bar, new Vector2(1, 0), new Vector2(-8f, 0f), new Vector2(width, 50f));
            ModernUiTheme.AttachShadow(bar, 10f);

            for (var i = 0; i < Primary.Length; i++)
            {
                var entry = Primary[i];
                buttons.TryGetValue(entry.Button, out var target);
                var tile = BuildTile(bar, entry.Label, entry.Icon(), i, tileWidth);
                if (target != null)
                    tile.onClick.AddListener(target.onClick.Invoke);
            }

            var menuTile = BuildTile(bar, "Menu", ModernUiIcons.Grid, Primary.Length, tileWidth);
            menuTile.onClick.AddListener(ToggleMenu);

            BuildMenu(host, buttons);

            Debug.Log($"[ModernDockBar] Folded {buttons.Count} window buttons into {count} tiles.");
        }

        /// <summary>One tile: its icon over its name, which is what makes it tappable.</summary>
        private static Button BuildTile(RectTransform bar, string label, Sprite icon, int index, float width)
        {
            var button = ModernUiTheme.CreateButton(bar, "Tile" + label, "", ModernUiTheme.CardColor,
                ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);

            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 0.5f),
                new Vector2(8f + index * (width + TileGap), 0f), new Vector2(width, 40f));

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
        private void BuildMenu(RectTransform host, IReadOnlyDictionary<string, Button> buttons)
        {
            //a full screen transparent sheet under the drawer, so that clicking anywhere
            //else puts it away. Without one the only way to close it is the tile again.
            clickCatcher = new GameObject("ModernDockCatcher", typeof(Image), typeof(Button));
            clickCatcher.transform.SetParent(host, false);
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

            menuPanel = ModernUiTheme.CreateCard(host, "ModernDockMenu", ModernUiTheme.WindowColor, true);
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
