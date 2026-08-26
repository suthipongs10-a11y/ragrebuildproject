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
            var bar = ModernUiTheme.ApplyWindowChrome(win, ModernUiIcons.Person);
            ModernUiTheme.AttachShadow(root);
            NameTheBar(bar, "เลือกตัวละคร", "Select your Character");

            foreach (var slot in win.CharacterSlots)
                StyleSlot(slot);

            StyleSurface(win.DisplayPane, ModernUiTheme.CardColor);
            StyleSurface(win.InfoArea1, ModernUiTheme.CardColor);
            StyleSurface(win.InfoArea2, ModernUiTheme.CardColor);

            StyleHeadline(win.CharacterName);

            if (win.Job != null)
            {
                win.Job.color = ModernUiTheme.AccentInkColor;
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
                {
                    PaintButton(confirm, ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor);
                    GrowButton(confirm);
                }

                //The other button on the row is the way out, and it is the only other one
                //there - found by walking the row rather than by name, since the row is a
                //prefab this code has no reference into.
                var row = confirm != null ? confirm.transform.parent : null;
                if (row != null)
                {
                    foreach (var other in row.GetComponentsInChildren<Button>(true))
                    {
                        if (other == confirm)
                            continue;

                        PaintButton(other, ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor);
                        GrowButton(other);
                    }
                }
            }

            ModernUiTheme.RepaintInk(root);
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
                    ModernUiTheme.AddBorder(win.WindowRect, ModernUiTheme.CardBorderColor);
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
            {
                PaintButton(win.SubmitButton, ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor);
                GrowButton(win.SubmitButton);
            }

            if (win.WindowRect != null)
                NameTheBar(FindDragBar(win.WindowRect), "เข้าสู่ระบบ", "Sign in");

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

            ModernUiTheme.RepaintInk(win.transform);
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

            AddSlotLabels(slot);
        }

        /// <summary>
        /// Writes the character's name and where they are standing on the card itself, and
        /// marks the highlighted one.
        /// </summary>
        /// <remarks>
        /// Anchored rather than placed, because the card is a prefab this code has never
        /// measured: the labels are pinned to the bottom edge and the chip to the top left
        /// corner, so they land correctly whatever size the slot turns out to be.
        /// </remarks>
        private static void AddSlotLabels(CharacterSelectPlayerButton slot)
        {
            var card = (RectTransform)slot.Button.transform;
            if (card.Find("ModernSlotName") != null)
                return;

            var name = ModernUiTheme.CreateText(card, "ModernSlotName", "", ModernUiTheme.SizeBody,
                ModernUiTheme.TitleColor, TextAlignmentOptions.Bottom, FontStyles.Bold);
            PinToBottom((RectTransform)name.transform, 26f, 22f);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            slot.SlotNameLabel = name;

            var place = ModernUiTheme.CreateText(card, "ModernSlotMap", "", ModernUiTheme.SizeSmall,
                ModernUiTheme.MutedColor, TextAlignmentOptions.Top);
            PinToBottom((RectTransform)place.transform, 8f, 18f);
            place.textWrappingMode = TextWrappingModes.NoWrap;
            slot.SlotMapLabel = place;

            //The highlighted slot is the one whose button has been switched off - that is how
            //the window has always marked it - so the chip watches interactable rather than
            //being told, and nothing in the window's own logic has to know this exists.
            var chip = ModernUiTheme.CreateCard(card, "ModernSelectedChip", ModernUiTheme.AccentColor);
            ModernUiTheme.Place(chip, new Vector2(0, 1), new Vector2(8f, -8f), new Vector2(74f, 22f));
            chip.GetComponent<Image>().raycastTarget = false;

            var chipText = ModernUiTheme.CreateText(chip, "Label", "เลือกอยู่", ModernUiTheme.SizeSmall - 1f,
                ModernUiTheme.AccentTextColor, TextAlignmentOptions.Center, FontStyles.Bold);
            ModernUiTheme.Stretch((RectTransform)chipText.transform, 0, 0, 0, 0);

            var watcher = chip.gameObject.AddComponent<SelectedChip>();
            watcher.Button = slot.Button;
            chip.gameObject.SetActive(false);
        }

        private static void PinToBottom(RectTransform rect, float bottom, float height)
        {
            rect.anchorMin = new Vector2(0, 0);
            rect.anchorMax = new Vector2(1, 0);
            rect.pivot = new Vector2(0.5f, 0);
            rect.offsetMin = new Vector2(4f, bottom);
            rect.offsetMax = new Vector2(-4f, bottom + height);
        }

        /// <summary>Shows the chip exactly while its slot is the highlighted one.</summary>
        private class SelectedChip : MonoBehaviour
        {
            public Button Button;

            private void Update()
            {
                var selected = Button != null && !Button.interactable;
                if (gameObject.activeSelf != selected)
                    gameObject.SetActive(selected);
            }
        }

        /// <summary>
        /// Puts the Thai name and the English one on the header, the smaller of the two in a
        /// quieter ink after it.
        /// </summary>
        /// <remarks>
        /// One text object carrying both rather than a second one underneath, because the
        /// header on these two windows is thirty five points tall and belongs to a prefab.
        /// Growing it to fit a subtitle would push it down over whatever the window has
        /// directly beneath, which on the picker is the row of character cards.
        /// </remarks>
        private static void NameTheBar(Transform bar, string thai, string english)
        {
            if (bar == null)
                return;

            foreach (var label in bar.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                //the close and menu chips in the corner carry no words; the title is the
                //only label on the band with anything in it
                if (string.IsNullOrWhiteSpace(label.text))
                    continue;

                label.richText = true;
                label.text = $"{thai}   <size=-5><color=#6A4008>{english}</color></size>";
                label.textWrappingMode = TextWrappingModes.NoWrap;
                return;
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

        /// <summary>The band along the top of a window, which every prefab here names "drag".</summary>
        private static Transform FindDragBar(Transform root)
        {
            for (var i = 0; i < root.childCount; i++)
            {
                var child = root.GetChild(i);
                if (child.name.ToLowerInvariant().Contains("drag"))
                    return child;
            }

            return null;
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

        /// <summary>
        /// A button on the title screen is the one thing on the screen a finger has to hit,
        /// and at thirty points tall it is under every guideline there is.
        /// </summary>
        /// <remarks>
        /// Taller only, never wider. The two buttons on the picker's bottom row sit a hundred
        /// and twelve points apart in a prefab this code cannot see; widening them to look
        /// like the mock up would have them overlapping by twenty, which is the sort of thing
        /// that is invisible from here and obvious the moment somebody opens the game.
        /// </remarks>
        private static void GrowButton(Button button)
        {
            var rect = (RectTransform)button.transform;
            var size = rect.sizeDelta;
            if (size.y >= 44f)
                return;

            rect.sizeDelta = new Vector2(size.x, 44f);
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
