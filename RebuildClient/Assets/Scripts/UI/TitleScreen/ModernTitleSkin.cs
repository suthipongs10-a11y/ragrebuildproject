using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.TitleScreen
{
    /// <summary>
    /// Themes the two screens a player meets before the game starts: the login box and
    /// the character picker. Character creation has a skin of its own next door.
    ///
    /// The picker shows which slot is highlighted by disabling that slot's button and
    /// letting the sprite swap show a different graphic, so the selected look cannot be
    /// set as a colour from out here. Two rounded sprites with the colour baked into
    /// them are handed to the slot instead, which leaves the window's own logic
    /// completely untouched.
    /// </summary>
    public class ModernTitleSkin : MonoBehaviour
    {
        private const float SearchInterval = 0.5f;

        private float searchTimer;
        private TextMeshProUGUI okLabel;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<ModernTitleSkin>() != null)
                return;

            var host = new GameObject("ModernTitleSkin");
            DontDestroyOnLoad(host);
            host.AddComponent<ModernTitleSkin>();
        }

        private void Update()
        {
            //the picker rewrites this label every time the highlighted slot changes, so
            //it is put back into Thai here rather than once at skin time
            if (okLabel != null)
            {
                if (okLabel.text == "OK" || okLabel.text == "Create")
                    okLabel.text = ThaiUiText.Get(okLabel.text);
            }

            searchTimer -= Time.deltaTime;
            if (searchTimer > 0)
                return;
            searchTimer = SearchInterval;

            var select = FindFirstObjectByType<CharacterSelectWindow>(FindObjectsInactive.Include);
            if (select != null && !ModernUiTheme.IsSkinned(select.gameObject))
                SkinCharacterSelect(select);

            var login = FindFirstObjectByType<LoginBox>(FindObjectsInactive.Include);
            if (login != null && !ModernUiTheme.IsSkinned(login.gameObject))
                SkinLogin(login);
        }

        private void SkinCharacterSelect(CharacterSelectWindow win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

            var root = (RectTransform)win.transform;
            ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Person);
            ModernUiTheme.AttachShadow(root);

            foreach (var slot in win.CharacterSlots)
                StyleSlot(slot);

            StyleSurface(win.DisplayPane, ModernUiTheme.CardColor);
            StyleSurface(win.InfoArea1, ModernUiTheme.CardColor);
            StyleSurface(win.InfoArea2, ModernUiTheme.CardColor);

            StyleHeadline(win.CharacterName);

            if (win.Job != null)
            {
                win.Job.color = ModernUiTheme.AccentColor;
                win.Job.fontSize = ModernUiTheme.SizeSubtitle;
                win.Job.fontStyle = FontStyles.Bold;
                win.Job.extraPadding = true;
            }

            if (win.Location != null)
            {
                win.Location.color = ModernUiTheme.LabelColor;
                win.Location.fontSize = ModernUiTheme.SizeSmall;
                win.Location.extraPadding = true;
            }

            StyleReadout(win.Level);
            StyleReadout(win.CharacterHp);
            StyleReadout(win.CharacterSp);
            StyleReadout(win.CharacterStr);
            StyleReadout(win.CharacterAgi);
            StyleReadout(win.CharacterVit);
            StyleReadout(win.CharacterInt);
            StyleReadout(win.CharacterDex);
            StyleReadout(win.CharacterLuk);

            //the confirm button is found through its label, the window holds no reference
            //to the button itself
            okLabel = win.OkButtonText;
            if (okLabel != null)
            {
                //the picker is usually switched off when this runs, so the search has to
                //be told to look at inactive objects too
                var confirm = okLabel.GetComponentInParent<Button>(true);
                if (confirm != null)
                    PaintButton(confirm, ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor);
            }

            ModernUiTheme.RecolorLightTexts(root);
            ModernUiTheme.RecolorAccents(root);
            ThaiUiText.Apply(root);

            Debug.Log("[ModernTitleSkin] Retinted the character select window.");
        }

        private static void SkinLogin(LoginBox win)
        {
            ModernUiTheme.MarkSkinned(win.gameObject);

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

            ModernUiTheme.StyleInputField(win.UsernameBox);
            ModernUiTheme.StyleInputField(win.PasswordBox);
            ModernUiTheme.StyleInputField(win.PasswordRepeatBox);
            ModernUiTheme.StyleInputField(win.ServerInputBox);

            if (win.UsernameLabelText != null)
            {
                win.UsernameLabelText.color = ModernUiTheme.LabelColor;
                win.UsernameLabelText.extraPadding = true;
            }

            ModernUiTheme.StyleTabBar(win.Tabs);

            if (win.SubmitButton != null)
                PaintButton(win.SubmitButton, ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor);

            if (win.RememberLoginToggle != null)
            {
                var check = win.RememberLoginToggle.graphic as Image;
                if (check != null)
                    check.color = ModernUiTheme.AccentColor;

                var box = win.RememberLoginToggle.targetGraphic as Image;
                if (box != null)
                {
                    box.sprite = ModernUiTheme.RoundedSprite;
                    box.type = Image.Type.Sliced;
                    box.color = ModernUiTheme.CardColor;
                }
            }

            ModernUiTheme.RecolorLightTexts(win.transform);
            ModernUiTheme.RecolorAccents(win.transform);
            ThaiUiText.Apply(win.transform);

            Debug.Log("[ModernTitleSkin] Retinted the login box.");
        }

        /// <summary>
        /// A character slot. The highlighted slot is the one whose button has been turned
        /// off, so the blue chip goes in as the sprite shown while disabled.
        /// </summary>
        private static void StyleSlot(CharacterSelectPlayerButton slot)
        {
            if (slot == null || slot.Button == null)
                return;

            var selected = ModernUiTheme.TintedRounded(ModernUiTheme.AccentColor);
            var idle = ModernUiTheme.TintedRounded(ModernUiTheme.CardColor);
            var hover = ModernUiTheme.TintedRounded(ModernUiTheme.CardDeepColor);

            slot.SelectedSprite = selected;
            slot.UnselectedSprite = idle;

            var image = slot.Button.GetComponent<Image>();
            if (image != null)
            {
                image.sprite = idle;
                image.type = Image.Type.Sliced;
                //the colour is baked into the sprite, so the tint has to be neutral or it
                //would be applied twice
                image.color = Color.white;
            }

            //the window shows the highlighted slot through spriteState.disabledSprite,
            //which only has an effect under this transition mode
            slot.Button.transition = Selectable.Transition.SpriteSwap;

            var state = slot.Button.spriteState;
            state.highlightedSprite = hover;
            state.pressedSprite = hover;
            state.selectedSprite = idle;
            state.disabledSprite = selected;
            slot.Button.spriteState = state;

            if (slot.UnavailableText != null)
            {
                slot.UnavailableText.color = ModernUiTheme.MutedColor;
                slot.UnavailableText.fontSize = ModernUiTheme.SizeSmall;
                slot.UnavailableText.extraPadding = true;
            }
        }

        private static void StyleSurface(GameObject target, Color color)
        {
            if (target == null)
                return;

            var image = target.GetComponent<Image>();
            if (image == null || image.color.a <= 0.1f)
                return;

            image.sprite = ModernUiTheme.RoundedSprite;
            image.type = Image.Type.Sliced;
            image.color = color;
        }

        private static void StyleHeadline(TextMeshProUGUI text)
        {
            if (text == null)
                return;

            text.color = ModernUiTheme.TitleColor;
            text.fontSize = ModernUiTheme.SizeTitle - 6;
            text.fontStyle = FontStyles.Bold;
            text.extraPadding = true;
        }

        private static void StyleReadout(TextMeshProUGUI text)
        {
            if (text == null)
                return;

            text.color = ModernUiTheme.NameColor;
            text.fontSize = ModernUiTheme.SizeBody;
            text.fontStyle = FontStyles.Bold;
            text.extraPadding = true;
        }

        private static void PaintButton(Button button, Color background, Color textColor)
        {
            var image = button.GetComponent<Image>();
            if (image != null)
            {
                image.sprite = ModernUiTheme.RoundedSprite;
                image.type = Image.Type.Sliced;
                image.color = background;
            }

            foreach (var label in button.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                label.color = textColor;
                label.fontStyle = FontStyles.Bold;
                label.extraPadding = true;
            }
        }
    }
}
