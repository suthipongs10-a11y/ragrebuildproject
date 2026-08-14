using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.TitleScreen
{
    /// <summary>
    /// Applies the shared card theme to the character creation window. The creator's
    /// logic and layout stay as they are: panels turn white, section boxes become soft
    /// cards, the create button gets the accent color and the hair swatches keep their
    /// own colors but pick up the rounded shape. Everything is reached through the
    /// window's public fields so nothing here depends on scene object names.
    /// </summary>
    public class ModernCreationSkin : MonoBehaviour
    {
        private const float SearchInterval = 0.5f;
        private float searchTimer;

        private class SkinMarker : MonoBehaviour { }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (FindFirstObjectByType<ModernCreationSkin>() != null)
                return;

            var host = new GameObject("ModernCreationSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernCreationSkin>();
        }

        private void Update()
        {
            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            var creator = FindFirstObjectByType<CharacterCreatorWindow>(FindObjectsInactive.Include);
            if (creator == null || creator.GetComponent<SkinMarker>() != null)
                return;

            ApplySkin(creator);
        }

        private static void ApplySkin(CharacterCreatorWindow win)
        {
            win.gameObject.AddComponent<SkinMarker>();

            var pane = win.Pane != null ? win.Pane.transform : win.transform;

            //the window backdrop and any plain section boxes go white and soft gray.
            //saturated images are left alone so artwork and icons keep their look.
            RestyleImage(win.Pane != null ? win.Pane.GetComponent<Image>() : win.GetComponent<Image>(),
                ModernUiTheme.WindowColor);

            for (var i = 0; i < pane.childCount; i++)
            {
                var child = pane.GetChild(i);
                var image = child.GetComponent<Image>();
                if (image == null || image.sprite != null && IsSaturated(image.color))
                    continue;
                if (child.childCount > 0)
                    RestyleImage(image, ModernUiTheme.CardColor);
            }

            //hair swatches keep their color but pick up the rounded shape
            if (win.ColorButtons != null)
            {
                foreach (var swatch in win.ColorButtons)
                {
                    if (swatch == null) continue;
                    var image = swatch.GetComponent<Image>();
                    if (image == null) continue;
                    image.sprite = ModernUiTheme.RoundedSprite;
                    image.type = Image.Type.Sliced;
                }
            }

            StyleButtons(win.GenderButtons, null);
            StyleButtons(win.StatUpButtons, ModernUiTheme.CardDeepColor);
            StyleButtons(win.StatDownButtons, ModernUiTheme.CardDeepColor);

            if (win.SaveButton != null)
                StylePrimary(win.SaveButton);

            //buttons the window doesn't expose directly, like cancel and the turn
            //arrows, are picked up by name so they still match
            foreach (var button in pane.GetComponentsInChildren<Button>(true))
            {
                var lower = button.name.ToLowerInvariant();
                if (lower.Contains("cancel") || lower.Contains("turn"))
                {
                    var image = button.GetComponent<Image>();
                    if (image != null)
                        RestyleImage(image, ModernUiTheme.CardDeepColor);
                }
            }

            if (win.StatTexts != null)
            {
                foreach (var stat in win.StatTexts)
                {
                    if (stat == null) continue;
                    stat.color = ModernUiTheme.NameColor;
                    stat.fontStyle = FontStyles.Bold;
                }
            }

            if (win.StatsRemainingText != null)
                win.StatsRemainingText.color = ModernUiTheme.HintColor;

            if (win.PlayerNameText != null)
            {
                var image = win.PlayerNameText.GetComponent<Image>();
                RestyleImage(image, ModernUiTheme.CardDeepColor);
                if (win.PlayerNameText.textComponent != null)
                    win.PlayerNameText.textComponent.color = ModernUiTheme.NameColor;
                if (win.PlayerNameText.placeholder is TextMeshProUGUI placeholder)
                    placeholder.color = ModernUiTheme.MutedColor;
            }

            ModernUiTheme.RecolorLightTexts(pane);

            //the create button label must stay white on the accent color
            if (win.SaveButton != null)
            {
                foreach (var label in win.SaveButton.GetComponentsInChildren<TextMeshProUGUI>(true))
                {
                    label.color = ModernUiTheme.AccentTextColor;
                    label.fontStyle = FontStyles.Bold;
                }
            }

            Debug.Log("[ModernCreationSkin] Retinted the character creation window.");
        }

        private static void StyleButtons(Button[] buttons, Color? background)
        {
            if (buttons == null)
                return;

            foreach (var button in buttons)
            {
                if (button == null) continue;
                var image = button.GetComponent<Image>();
                if (image == null) continue;

                image.sprite = ModernUiTheme.RoundedSprite;
                image.type = Image.Type.Sliced;
                if (background.HasValue)
                    image.color = background.Value;
            }
        }

        private static void StylePrimary(Button button)
        {
            var image = button.GetComponent<Image>();
            if (image == null) return;
            image.sprite = ModernUiTheme.RoundedSprite;
            image.type = Image.Type.Sliced;
            image.color = ModernUiTheme.AccentColor;
        }

        private static void RestyleImage(Image image, Color color)
        {
            if (image == null) return;
            image.sprite = ModernUiTheme.RoundedSprite;
            image.type = Image.Type.Sliced;
            image.color = color;
        }

        private static bool IsSaturated(Color c)
        {
            var max = Mathf.Max(c.r, Mathf.Max(c.g, c.b));
            var min = Mathf.Min(c.r, Mathf.Min(c.g, c.b));
            return max - min > 0.25f;
        }
    }
}
