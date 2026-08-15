using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.ClientDatabase
{
    /// <summary>
    /// Puts the database window into the shared theme. Nothing here moves an element:
    /// the window builds its rows and detail panes from code that would overwrite any
    /// new layout, so this recolours the pieces it already has, gives the tabs, search
    /// boxes and scrollbars the theme's shapes, and leaves the arrangement alone.
    /// The two tab colours themselves live in ClientDatabaseWindow.Utils, because
    /// ShowTab reapplies them on every click.
    /// </summary>
    public class ModernDatabaseSkin : MonoBehaviour
    {
        private const float SearchInterval = 0.5f;

        private float searchTimer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernDatabaseSkin>() != null)
                return;

            var host = new GameObject("ModernDatabaseSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernDatabaseSkin>();
        }

        private void Update()
        {
            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            var window = UiManager.Instance != null ? UiManager.Instance.ClientDatabaseWindow : null;
            if (window == null)
                window = FindFirstObjectByType<ClientDatabaseWindow>(FindObjectsInactive.Include);

            if (window == null || ModernUiTheme.IsSkinned(window.gameObject))
                return;

            Skin(window);
        }

        private static void Skin(ClientDatabaseWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Book);

            //the panel behind the tabs is the window's real backdrop, the outer rect is
            //only there to be dragged around, so the shadow is hung off the panel: on the
            //outer rect it would draw a halo around whatever size that happens to be
            if (win.panelRT != null)
            {
                var panel = win.panelRT.GetComponent<Image>();
                if (panel != null && panel.color.a > 0.1f)
                {
                    panel.sprite = ModernUiTheme.RoundedSprite;
                    panel.type = Image.Type.Sliced;
                    panel.color = ModernUiTheme.WindowColor;
                    ModernUiTheme.AddBorder(win.panelRT, ModernUiTheme.CardBorderColor);
                }

                ModernUiTheme.AttachShadow(win.panelRT);
            }
            else
            {
                ModernUiTheme.AttachShadow(root);
            }

            BuildRail(win);

            StyleSearch(win.monsterSearchField, win.monsterSearchGhost);
            StyleSearch(win.itemSearchField, win.itemSearchGhost);
            StyleSearch(win.mapSearchField, win.mapSearchGhost);
            StyleSearch(win.npcSearchField, win.npcSearchGhost);

            StyleListTitle(win.monsterListTitleText);
            StyleListTitle(win.itemListTitleText);
            StyleListTitle(win.mapListTitleText);
            StyleListTitle(win.npcListTitleText);

            StyleDetailName(win.monsterDetailNameText);
            StyleDetailName(win.itemDetailNameText);
            StyleDetailName(win.mapDetailNameText);
            StyleDetailName(win.npcDetailNameText);

            StyleDetailBody(win.monsterDetailStatsText);
            StyleDetailBody(win.itemDetailDescText);
            StyleDetailBody(win.npcDetailStatsText);
            StyleDetailBody(win.helpContentText);

            StyleBackButton(win.monsterBackButton);
            StyleBackButton(win.itemBackButton);
            StyleBackButton(win.mapBackButton);
            StyleBackButton(win.npcBackButton);

            StyleListSurface(win.monsterListContent);
            StyleListSurface(win.itemListContent);
            StyleListSurface(win.mapListContent);
            StyleListSurface(win.npcListContent);

            //every row in every list is cloned from one of these two, so tinting the
            //templates covers rows the window has not built yet
            if (win.rowTemplate != null)
                ModernUiTheme.RepaintInk(win.rowTemplate.transform);
            if (win.iconRowTemplate != null)
                ModernUiTheme.RepaintInk(win.iconRowTemplate.transform);

            AddMapTeleportButton(win);

            //this window builds its own close button rather than inheriting a drag bar,
            //so it needs the x drawn on it the same way every other window gets one
            ModernUiTheme.StyleCloseButton(win.closeButton);
            ModernUiTheme.StyleCloseButtons(root);

            ModernUiTheme.StyleScrollViews(root);
            ModernUiTheme.RepaintInk(root);
            ModernUiTheme.RecolorAccents(root);
            ThaiUiText.Apply(root);

            Debug.Log("[ModernDatabaseSkin] Retinted the database window.");
        }

        private const float RailWidth = 152f;
        private const float RailRow = 44f;
        private const float RailGap = 8f;
        private const float RailTop = 66f;
        private const float RailInset = 12f;

        /// <summary>
        /// Moves the five tabs from a row along the top into a rail down the left side.
        ///
        /// Five tabs in a row is what pushed this window's header into a strip of tiny
        /// evenly-squeezed buttons; down the side each gets its full name and an icon, and
        /// the reading pane gets the whole width back. Each tab keeps its own image and
        /// button, so ShowTab still colours them and still switches the panes; they are
        /// only reparented onto the panel so their positions can be set from one place.
        /// </summary>
        private static void BuildRail(ClientDatabaseWindow win)
        {
            var panel = win.panelRT;
            if (panel == null)
                return;

            var tabs = new[]
            {
                win.monstersTabImage, win.itemsTabImage, win.mapsTabImage,
                win.npcsTabImage, win.helpTabImage
            };
            var icons = new[]
            {
                ModernUiIcons.Smile, ModernUiIcons.Bag, ModernUiIcons.Grid,
                ModernUiIcons.Person, ModernUiIcons.Book
            };
            var panes = new[]
            {
                win.monstersContainer, win.itemsContainer, win.mapsContainer,
                win.npcsContainer, win.helpContainer
            };

            var row = 0;
            for (var i = 0; i < tabs.Length; i++)
            {
                var tab = tabs[i];
                if (tab == null)
                    continue;

                tab.sprite = ModernUiTheme.RoundedSprite;
                tab.type = Image.Type.Sliced;

                var rect = (RectTransform)tab.transform;
                rect.SetParent(panel, false);
                rect.localScale = Vector3.one;
                ModernUiTheme.Place(rect, new Vector2(0, 1),
                    new Vector2(RailInset, -(RailTop + row * (RailRow + RailGap))),
                    new Vector2(RailWidth, RailRow));

                if (rect.Find("ModernRailIcon") == null)
                {
                    var glyph = ModernUiTheme.CreateIcon(rect, icons[i], ModernUiTheme.AccentInkColor, 18);
                    glyph.gameObject.name = "ModernRailIcon";
                    ModernUiTheme.Place(glyph.rectTransform, new Vector2(0, 0.5f), new Vector2(13f, 0f),
                        new Vector2(18f, 18f));
                }

                foreach (var label in tab.GetComponentsInChildren<TextMeshProUGUI>(true))
                {
                    label.fontSize = ModernUiTheme.SizeLabel;
                    label.fontStyle = FontStyles.Bold;
                    label.alignment = TextAlignmentOptions.Left;
                    label.extraPadding = true;
                    ModernUiTheme.Stretch(label.rectTransform, 40f, 0f, -8f, 0f);
                }

                row++;
            }

            //the panes give up the strip the rail now occupies. Only a pane that spans its
            //parent is touched: on one pinned to a corner an inset would be meaningless.
            foreach (var pane in panes)
            {
                if (pane == null)
                    continue;

                var rect = pane.transform as RectTransform;
                if (rect == null || rect.anchorMin.x > 0.1f || rect.anchorMax.x < 0.9f)
                    continue;

                rect.offsetMin = new Vector2(RailWidth + RailInset * 2f, rect.offsetMin.y);
            }
        }

        private static void StyleSearch(TMP_InputField field, TextMeshProUGUI ghost)
        {
            ModernUiTheme.StyleInputField(field);

            //the ghost is the window's own autocomplete preview drawn behind the caret,
            //not a placeholder, so it wants to stay quiet without disappearing
            if (ghost != null)
            {
                ghost.color = ModernUiTheme.MutedColor;
                ghost.extraPadding = true;
            }
        }

        private static void StyleListTitle(TextMeshProUGUI text)
        {
            if (text == null)
                return;

            text.color = ModernUiTheme.TitleColor;
            text.fontSize = ModernUiTheme.SizeValue;
            text.fontStyle = FontStyles.Bold;
            text.extraPadding = true;
        }

        private static void StyleDetailName(TextMeshProUGUI text)
        {
            if (text == null)
                return;

            text.color = ModernUiTheme.TitleColor;
            text.fontSize = ModernUiTheme.SizeTitle - 6;
            text.fontStyle = FontStyles.Bold;
            text.extraPadding = true;
        }

        private static void StyleDetailBody(TextMeshProUGUI text)
        {
            if (text == null)
                return;

            //the stat blocks carry their own colour tags for elements and sizes, so only
            //the base colour is set and the rich text is left to do its job
            text.color = ModernUiTheme.NameColor;
            text.fontSize = ModernUiTheme.SizeBody;
            text.extraPadding = true;
        }

        /// <summary>
        /// Puts a warp button under the list of connected maps.
        ///
        /// Getting to a map from here was already possible by right clicking its picture,
        /// but nothing on screen said so, so in practice it did not exist. The list of
        /// exits above it ended well short of the bottom of its own box, which is exactly
        /// the room a button needs; the list gives up that much height and the button
        /// takes it, so the pane still finishes level with the map picture beside it.
        /// </summary>
        private static void AddMapTeleportButton(ClientDatabaseWindow win)
        {
            const float ButtonHeight = 28f;
            const float Gap = 6f;

            //Content -> Viewport -> the scroll rect that owns them, whose sibling we want
            //to become. Walking up from the content is what keeps this working if the
            //window's own layout is ever rearranged.
            var scroll = win.mapConnectionsContent?.transform.parent?.parent as RectTransform;
            var pane = scroll?.parent as RectTransform;
            if (pane == null || pane.Find(TeleportButtonName) != null)
                return;

            scroll.sizeDelta = new Vector2(scroll.sizeDelta.x, scroll.sizeDelta.y - ButtonHeight - Gap);

            var button = ModernUiTheme.CreateIconButton(pane, TeleportButtonName, "Teleport To Map",
                ModernUiIcons.Target, ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor);

            //copied off the list above rather than written out, so the two line up down
            //both edges whatever the pane is doing
            var rect = (RectTransform)button.transform;
            rect.anchorMin = scroll.anchorMin;
            rect.anchorMax = scroll.anchorMax;
            rect.pivot = scroll.pivot;
            rect.sizeDelta = new Vector2(scroll.sizeDelta.x, ButtonHeight);
            rect.anchoredPosition = new Vector2(scroll.anchoredPosition.x,
                scroll.anchoredPosition.y - scroll.sizeDelta.y - Gap);

            button.onClick.AddListener(win.TeleportToShownMap);
        }

        private const string TeleportButtonName = "ModernMapTeleport";

        private static void StyleBackButton(Button button)
        {
            if (button == null)
                return;

            var image = button.GetComponent<Image>();
            if (image != null)
            {
                image.sprite = ModernUiTheme.RoundedSprite;
                image.type = Image.Type.Sliced;
                image.color = ModernUiTheme.CardColor;
            }

            foreach (var label in button.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                label.color = ModernUiTheme.AccentInkColor;
                label.fontStyle = FontStyles.Bold;
                label.extraPadding = true;
            }
        }

        /// <summary>
        /// The list content sits inside a scroll view; giving the viewport a soft card
        /// separates the rows from the window behind them.
        /// </summary>
        private static void StyleListSurface(GameObject content)
        {
            if (content == null)
                return;

            //four of the five tabs are switched off when this runs, and the search that
            //skips inactive objects would find nothing for any of them
            var scroll = content.GetComponentInParent<ScrollRect>(true);
            if (scroll == null || scroll.viewport == null)
                return;

            var image = scroll.viewport.GetComponent<Image>();
            if (image == null || image.color.a <= 0.1f)
                return;

            //left as whatever sprite the viewport already had: it doubles as the mask for
            //the rows, and swapping it would change what the list clips against
            image.color = ModernUiTheme.CardDeepColor;
        }
    }
}
