using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Inventory
{
    /// <summary>
    /// Themes the item description card, the small window that opens when an item is
    /// right clicked. There are two of them alive at once, the main one and the second
    /// used for comparing a card against the item it would go into, and both are
    /// handled here. The card illustration viewer gets the same treatment.
    ///
    /// The window rewrites its own name and description every time a different item is
    /// shown, so only colour, size and weight are set here, never the text itself.
    /// </summary>
    public class ModernItemDetailSkin : MonoBehaviour
    {
        private const float SearchInterval = 0.5f;

        private float searchTimer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernItemDetailSkin>() != null)
                return;

            var host = new GameObject("ModernItemDetailSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernItemDetailSkin>();
        }

        private void Update()
        {
            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            var ui = UiManager.Instance;
            if (ui == null)
                return;

            if (ui.ItemDescriptionWindow != null && !ModernUiTheme.IsSkinned(ui.ItemDescriptionWindow.gameObject))
                Skin(ui.ItemDescriptionWindow);

            if (ui.SubDescriptionWindow != null && !ModernUiTheme.IsSkinned(ui.SubDescriptionWindow.gameObject))
                Skin(ui.SubDescriptionWindow);

            if (ui.CardIllustrationWindow != null && !ModernUiTheme.IsSkinned(ui.CardIllustrationWindow.gameObject))
                SkinIllustration(ui.CardIllustrationWindow);
        }

        private static void Skin(ItemDescriptionWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win);

            //the window's own rect is what actually carries the panel, the outer object
            //is only there to be positioned
            if (win.WindowRect != null)
            {
                var panel = win.WindowRect.GetComponent<Image>();
                if (panel != null && panel.color.a > 0.1f)
                {
                    panel.sprite = ModernUiTheme.RoundedSprite;
                    panel.type = Image.Type.Sliced;
                    panel.color = ModernUiTheme.WindowColor;
                }

                ModernUiTheme.AttachShadow(win.WindowRect);
            }
            else
            {
                ModernUiTheme.AttachShadow(root);
            }

            //a soft tile behind the icon, which is drawn small and otherwise floats on
            //the panel with nothing to sit against
            if (win.PortraitContainer != null)
            {
                ModernUiTheme.CardBehind(win.PortraitContainer.rectTransform, "ModernPortraitCard",
                    ModernUiTheme.CardDeepColor, 6, 6);
                win.PortraitContainer.preserveAspect = true;
            }

            if (win.ItemName != null)
            {
                win.ItemName.color = ModernUiTheme.TitleColor;
                win.ItemName.fontSize = ModernUiTheme.SizeValue;
                win.ItemName.fontStyle = FontStyles.Bold;
                win.ItemName.extraPadding = true;
            }

            if (win.ItemDescription != null)
            {
                //descriptions arrive with their own colour and size tags from the data
                //files, so only the base ink is set and the markup does the rest
                win.ItemDescription.color = ModernUiTheme.NameColor;
                win.ItemDescription.fontSize = ModernUiTheme.SizeBody;
                win.ItemDescription.extraPadding = true;
            }

            if (win.CardSocketPanel != null)
            {
                var socket = win.CardSocketPanel.GetComponent<Image>();
                if (socket != null && socket.color.a > 0.1f)
                {
                    socket.sprite = ModernUiTheme.RoundedSprite;
                    socket.type = Image.Type.Sliced;
                    socket.color = ModernUiTheme.CardColor;
                }
            }

            if (win.ShowIllustrationButton != null)
            {
                var image = win.ShowIllustrationButton.GetComponent<Image>();
                if (image != null)
                {
                    image.sprite = ModernUiTheme.RoundedSprite;
                    image.type = Image.Type.Sliced;
                    image.color = ModernUiTheme.AccentColor;
                }

                foreach (var label in win.ShowIllustrationButton.GetComponentsInChildren<TextMeshProUGUI>(true))
                {
                    label.color = ModernUiTheme.AccentTextColor;
                    label.fontStyle = FontStyles.Bold;
                    label.extraPadding = true;
                }
            }

            ModernUiTheme.StyleScrollViews(root);
            ModernUiTheme.RecolorLightTexts(root);
            ModernUiTheme.RecolorAccents(root);
            ThaiUiText.Apply(root);

            Debug.Log($"[ModernItemDetailSkin] Retinted {win.name}.");
        }

        private static void SkinIllustration(CardIllustrationWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win);
            ModernUiTheme.AttachShadow(root);
            ModernUiTheme.RecolorLightTexts(root);
            ModernUiTheme.RecolorAccents(root);
            ThaiUiText.Apply(root);

            Debug.Log("[ModernItemDetailSkin] Retinted the card illustration window.");
        }
    }
}
