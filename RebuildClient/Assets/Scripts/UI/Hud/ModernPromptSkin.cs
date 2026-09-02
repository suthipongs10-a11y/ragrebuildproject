using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// Gives the two prompt boxes - the yes/no confirmation and the one line text entry -
    /// the same head as every other window: a tinted band, a badge icon, and a title that
    /// says what is being asked before the question underneath it is read.
    /// </summary>
    /// <remarks>
    /// Both boxes are in the scene rather than in a prefab and both are older than the
    /// theme, so they turned up as a bare rectangle with a sentence in it. That is a poor
    /// thing to hang a bid on: the one moment a player most needs to know what they are
    /// agreeing to is the moment the window says least about itself.
    ///
    /// Built at runtime for the same reason the rest of the theme is - the scene file is a
    /// mile of yaml, and a conflict in it costs more than this code does.
    ///
    /// The header goes on in one of two ways depending on the box. The yes/no box is driven
    /// by a vertical layout group with a content size fitter, so the band is simply another
    /// child at the top and the box grows to make room for it by itself. The text box has no
    /// layout group at all, so the room is made by hand: the box is grown and everything
    /// already in it is pushed down by however far its own anchor moved.
    /// </remarks>
    public class ModernPromptSkin : MonoBehaviour
    {
        private const float BarHeight = 44f;
        private const float BadgeSize = 28f;
        private const float BadgeInset = 14f;

        private TextMeshProUGUI titleLabel;
        private Image badgeIcon;
        private string fallbackTitle;
        private Sprite fallbackSprite;

        /// <summary>
        /// Names the prompt about to be shown. Called by the two windows as they open, so
        /// the band reads "ยืนยันการบิด" over a bid and "ตั้งราคา" over a price, rather than
        /// one word covering everything.
        /// </summary>
        public static void SetHeader(GameObject window, string title, Sprite icon)
        {
            if (window == null)
                return;

            var skin = window.GetComponent<ModernPromptSkin>();
            if (skin == null)
                return;

            if (skin.titleLabel != null)
                skin.titleLabel.text = string.IsNullOrWhiteSpace(title) ? skin.fallbackTitle : title;

            if (skin.badgeIcon != null)
                skin.badgeIcon.sprite = icon != null ? icon : skin.fallbackSprite;
        }

        /// <summary>Dresses a prompt box once. Safe to call every frame; it only bites once.</summary>
        public static void Skin(GameObject window, string title, Sprite icon)
        {
            if (window == null || !ModernUiTheme.SkinsEnabled || ModernUiTheme.IsSkinned(window))
                return;

            ModernUiTheme.MarkSkinned(window);

            var root = (RectTransform)window.transform;

            //Captured before anything is added, because the manual path below moves every
            //child it finds and the band is not one of the children that needs moving.
            var existing = new RectTransform[root.childCount];
            for (var i = 0; i < root.childCount; i++)
                existing[i] = root.GetChild(i) as RectTransform;

            var skin = window.GetComponent<ModernPromptSkin>();
            if (skin == null)
                skin = window.AddComponent<ModernPromptSkin>();

            skin.fallbackTitle = title;
            skin.fallbackSprite = icon;

            PaintPanel(window);
            var bar = skin.BuildHeader(root, title, icon, existing);

            StyleContents(root, bar);

            //After the header, so neither ends up in the list of children to push down.
            ModernUiTheme.AttachShadow(root);
            ModernUiTheme.AddBorder(root, ModernUiTheme.CardBorderColor);
        }

        private static void PaintPanel(GameObject window)
        {
            var panel = window.GetComponent<Image>();
            if (panel == null)
                return;

            panel.sprite = ModernUiTheme.RoundedSprite;
            panel.type = Image.Type.Sliced;
            panel.color = ModernUiTheme.WindowColor;
        }

        private RectTransform BuildHeader(RectTransform root, string title, Sprite icon, RectTransform[] existing)
        {
            var group = root.GetComponent<VerticalLayoutGroup>();

            var barObject = new GameObject("ModernPromptBar", typeof(Image));
            barObject.transform.SetParent(root, false);
            var bar = (RectTransform)barObject.transform;

            var barImage = barObject.GetComponent<Image>();
            barImage.sprite = ModernUiTheme.HeaderSprite;
            barImage.type = Image.Type.Sliced;
            barImage.color = ModernUiTheme.TitleBarColor;
            barImage.raycastTarget = false;

            if (group != null)
            {
                //A row of its own at the top of the stack. The box's own content size fitter
                //then grows it to fit, which is why nothing here has to move anything. The
                //group is told not to control child width, so the band has to be given the
                //box's width itself - read off sizeDelta as well, because these boxes are
                //dressed while switched off and a rect that has never been laid out reports
                //a width of nothing.
                var padding = group.padding;
                padding.top = 0;
                group.padding = padding;

                var width = root.rect.width > 1f ? root.rect.width : root.sizeDelta.x;

                bar.SetSiblingIndex(0);
                bar.sizeDelta = new Vector2(width, BarHeight);

                var element = barObject.AddComponent<LayoutElement>();
                element.minHeight = BarHeight;
                element.preferredHeight = BarHeight;
                element.minWidth = width;
                element.preferredWidth = width;
            }
            else
            {
                MakeRoomAtTop(root, existing, BarHeight);

                bar.anchorMin = new Vector2(0, 1);
                bar.anchorMax = new Vector2(1, 1);
                bar.pivot = new Vector2(0.5f, 1);
                bar.offsetMin = new Vector2(0, -BarHeight);
                bar.offsetMax = Vector2.zero;
            }

            var badge = ModernUiTheme.CreateCard(bar, "Badge", ModernUiTheme.AccentColor);
            ModernUiTheme.Place(badge, new Vector2(0, 0.5f),
                new Vector2(BadgeInset, 0f), new Vector2(BadgeSize, BadgeSize));
            badgeIcon = ModernUiTheme.CreateIcon(badge, icon, ModernUiTheme.AccentTextColor, 17f);

            titleLabel = ModernUiTheme.CreateText(bar, "Title", title, ModernUiTheme.SizeBody + 3f,
                ModernUiTheme.TitleColor, TextAlignmentOptions.Left, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)titleLabel.transform, new Vector2(0, 0.5f),
                new Vector2(BadgeInset * 2f + BadgeSize, 0f), new Vector2(300f, BarHeight));

            //the hairline that stops the band and the panel reading as one soft area
            var rule = new GameObject("Rule", typeof(Image));
            rule.transform.SetParent(bar, false);
            var ruleImage = rule.GetComponent<Image>();
            ruleImage.color = ModernUiTheme.AccentColor;
            ruleImage.raycastTarget = false;

            var ruleRect = (RectTransform)rule.transform;
            ruleRect.anchorMin = new Vector2(0, 0);
            ruleRect.anchorMax = new Vector2(1, 0);
            ruleRect.pivot = new Vector2(0.5f, 0);
            ruleRect.offsetMin = Vector2.zero;
            ruleRect.offsetMax = new Vector2(0, 3);

            return bar;
        }

        /// <summary>
        /// Grows a box by <paramref name="height"/> and pushes what is already inside it
        /// down, so the new space all ends up at the top.
        /// </summary>
        /// <remarks>
        /// A box grows about its own pivot, so half the new height appears above the old top
        /// edge and half below the old bottom. How far a child has to move to stay where it
        /// looks depends on where it is anchored: one pinned to the bottom has not moved
        /// relative to the content at all, one in the middle has moved half the new height,
        /// one pinned to the top the whole of it. Which is exactly height times the anchor.
        /// A child stretched between top and bottom keeps its foot and gives up the room at
        /// its head instead.
        /// </remarks>
        private static void MakeRoomAtTop(RectTransform root, RectTransform[] existing, float height)
        {
            root.sizeDelta = new Vector2(root.sizeDelta.x, root.sizeDelta.y + height);

            for (var i = 0; i < existing.Length; i++)
            {
                var child = existing[i];
                if (child == null)
                    continue;

                if (Mathf.Approximately(child.anchorMin.y, child.anchorMax.y))
                    child.anchoredPosition -= new Vector2(0f, height * child.anchorMin.y);
                else
                    child.offsetMax -= new Vector2(0f, height);
            }
        }

        /// <summary>Repaints what the box already had: its text, its buttons, its field.</summary>
        private static void StyleContents(RectTransform root, RectTransform bar)
        {
            foreach (var field in root.GetComponentsInChildren<TMP_InputField>(true))
                ModernUiTheme.StyleInputField(field);

            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                if (bar != null && text.transform.IsChildOf(bar))
                    continue;
                if (text.GetComponentInParent<TMP_InputField>() != null)
                    continue;
                if (text.GetComponentInParent<Button>() != null)
                    continue;

                text.color = ModernUiTheme.NameColor;
                ModernUiTheme.MakeCrisp(text);
            }

            //The button that acts carries the accent; the one beside it is the way out and
            //stays quiet. Which is which comes off the yes/no box's own reference rather
            //than off the order they sit in, so somebody rearranging the scene cannot end
            //up with cancel painted as the thing to press. The text box has only one.
            var yesNo = root.GetComponent<YesNoOptionWindow>();
            var primaryLabel = yesNo != null ? yesNo.YesButtonText : null;

            var buttons = root.GetComponentsInChildren<Button>(true);
            for (var i = 0; i < buttons.Length; i++)
            {
                var primary = primaryLabel != null
                    ? primaryLabel.transform.IsChildOf(buttons[i].transform)
                    : i == 0;
                StyleButton(buttons[i], primary);
            }
        }

        private static void StyleButton(Button button, bool primary)
        {
            var image = button.GetComponent<Image>();
            if (image != null)
            {
                image.sprite = ModernUiTheme.RoundedSprite;
                image.type = Image.Type.Sliced;
                image.color = primary ? ModernUiTheme.AccentColor : ModernUiTheme.CardDeepColor;
            }

            //the tint the button flashes on hover multiplies this colour, so leaving it
            //white is what keeps the two above looking like the colours that were chosen
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(0.90f, 0.94f, 1f);
            colors.pressedColor = new Color(0.80f, 0.86f, 0.95f);
            colors.selectedColor = Color.white;
            button.colors = colors;

            foreach (var label in button.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                label.color = primary ? ModernUiTheme.AccentTextColor : ModernUiTheme.NameColor;
                label.fontStyle = FontStyles.Bold;
                ModernUiTheme.MakeCrisp(label);
            }

            if (!primary)
                ModernUiTheme.AddBorder((RectTransform)button.transform, ModernUiTheme.CardBorderColor);
        }
    }
}
