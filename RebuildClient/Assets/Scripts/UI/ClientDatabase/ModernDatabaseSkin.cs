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
                }

                ModernUiTheme.AttachShadow(win.panelRT);
            }
            else
            {
                ModernUiTheme.AttachShadow(root);
            }

            StyleTab(win.monstersTabImage);
            StyleTab(win.itemsTabImage);
            StyleTab(win.mapsTabImage);
            StyleTab(win.helpTabImage);
            StyleTab(win.npcsTabImage);

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
                ModernUiTheme.RecolorLightTexts(win.rowTemplate.transform);
            if (win.iconRowTemplate != null)
                ModernUiTheme.RecolorLightTexts(win.iconRowTemplate.transform);

            if (win.closeButton != null)
            {
                var closeImage = win.closeButton.GetComponent<Image>();
                if (closeImage != null)
                {
                    closeImage.sprite = ModernUiTheme.RoundedSprite;
                    closeImage.type = Image.Type.Sliced;
                    closeImage.color = ModernUiTheme.CardColor;
                }
            }

            ModernUiTheme.StyleScrollViews(root);
            ModernUiTheme.RecolorLightTexts(root);
            ModernUiTheme.RecolorAccents(root);
            ThaiUiText.Apply(root);

            Debug.Log("[ModernDatabaseSkin] Retinted the database window.");
        }

        private static void StyleTab(Image tab)
        {
            if (tab == null)
                return;

            //the colour is driven by ShowTab, this only replaces the shape underneath it
            tab.sprite = ModernUiTheme.RoundedSprite;
            tab.type = Image.Type.Sliced;

            foreach (var label in tab.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                label.fontSize = ModernUiTheme.SizeLabel;
                label.fontStyle = FontStyles.Bold;
                label.extraPadding = true;
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
                label.color = ModernUiTheme.AccentColor;
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
