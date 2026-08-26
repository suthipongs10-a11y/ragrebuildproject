using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Party
{
    /// <summary>
    /// A conversation with one person, in a window of its own.
    /// </summary>
    /// <remarks>
    /// One window per person rather than one window with a list of names down the side.
    /// Two conversations at once is rare, three is rarer still, and a window that is only
    /// ever showing one thing does not need a way to choose which - where it does happen,
    /// two small windows side by side beat one window you have to keep switching.
    ///
    /// The log lives on the window and dies with it. Nothing is kept between sessions and
    /// nothing is asked of the server: a private message here is a line handed from one
    /// player to another while both are online, and there is no mailbox behind it.
    /// </remarks>
    public class WhisperWindow : WindowBase
    {
        private const float Width = 380f;
        private const float Height = 300f;
        private const float Pad = 12f;
        private const float EntryHeight = 40f;
        private const int MaxLines = 120;

        private static readonly Dictionary<string, WhisperWindow> open = new();

        private string otherName;
        private RectTransform body;
        private TMP_InputField entry;
        private TextMeshProUGUI log;
        private readonly List<string> lines = new();

        // =====================================================================
        // Opening

        /// <summary>Opens the conversation with one person, or brings it forward.</summary>
        public static void Open(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                return;

            name = name.Trim();

            if (open.TryGetValue(name, out var existing) && existing != null)
            {
                existing.gameObject.SetActive(true);
                existing.MoveToTop();
                existing.FitWindowIntoPlayArea();
                existing.FocusEntry();
                return;
            }

            var window = Build(name);
            if (window == null)
                return;

            open[name] = window;
            window.MoveToTop();
            window.FitWindowIntoPlayArea();
            window.FocusEntry();
        }

        /// <summary>
        /// Puts one line into the right conversation, opening it if there is not one.
        /// </summary>
        /// <remarks>
        /// Opened on arrival rather than announced in the chat log and left for the player
        /// to find. A message nobody notices is a message that did not arrive, and the
        /// window is the only thing on screen that says which of them it came from.
        /// </remarks>
        public static void Deliver(string otherName, string text, bool isOutgoing)
        {
            if (string.IsNullOrWhiteSpace(otherName))
                return;

            Open(otherName);

            if (!open.TryGetValue(otherName.Trim(), out var window) || window == null)
                return;

            var mine = PlayerState.Instance != null ? PlayerState.Instance.PlayerName : "คุณ";
            window.Append(isOutgoing ? mine : otherName, text, isOutgoing);
        }

        private static WhisperWindow Build(string name)
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            var host = new GameObject("WhisperWindow_" + name, typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<WhisperWindow>();
            window.otherName = name;
            window.CanCloseWithEscape = true;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            //Offset a little per window so a second conversation does not land exactly on
            //top of the first and look like the first one simply changed name.
            rect.anchoredPosition = new Vector2(open.Count * 26f, open.Count * -26f);
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, name, "ข้อความส่วนตัว", ModernUiIcons.Person);
            ModernUiTheme.AttachShadow(rect);

            var viewport = ModernUiTheme.CreateCard(rect, "Viewport", ModernUiTheme.CardColor);
            viewport.anchorMin = new Vector2(0, 0);
            viewport.anchorMax = new Vector2(1, 1);
            viewport.offsetMin = new Vector2(Pad, Pad + EntryHeight + 6f);
            viewport.offsetMax = new Vector2(-Pad, -(ModernUiTheme.TitleBarHeight + 4f));
            viewport.gameObject.AddComponent<RectMask2D>();

            window.body = ModernUiTheme.CreateRect("Lines", viewport);
            window.body.anchorMin = new Vector2(0, 1);
            window.body.anchorMax = new Vector2(1, 1);
            window.body.pivot = new Vector2(0.5f, 1);
            window.body.offsetMin = Vector2.zero;
            window.body.offsetMax = Vector2.zero;

            window.log = ModernUiTheme.CreateText(window.body, "Log", "", ModernUiTheme.SizeSmall,
                ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Stretch((RectTransform)window.log.transform, 8f, 0f, -8f, 0f);
            window.log.textWrappingMode = TextWrappingModes.Normal;

            var scroll = host.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = window.body;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 32f;

            window.BuildEntryRow(rect);

            host.SetActive(true);
            return window;
        }

        private void BuildEntryRow(RectTransform rect)
        {
            var field = ModernUiTheme.CreateCard(rect, "Entry", ModernUiTheme.CardDeepColor);
            field.anchorMin = new Vector2(0, 0);
            field.anchorMax = new Vector2(1, 0);
            field.pivot = new Vector2(0.5f, 0);
            field.offsetMin = new Vector2(Pad, Pad);
            field.offsetMax = new Vector2(-(Pad + 74f), Pad + EntryHeight);

            var text = ModernUiTheme.CreateText(field, "Text", "", ModernUiTheme.SizeSmall,
                ModernUiTheme.NameColor, TextAlignmentOptions.Left);
            ModernUiTheme.Stretch((RectTransform)text.transform, 10f, 4f, -10f, -4f);
            text.raycastTarget = true;

            entry = field.gameObject.AddComponent<TMP_InputField>();
            entry.textComponent = text;
            entry.textViewport = field;
            entry.lineType = TMP_InputField.LineType.SingleLine;
            entry.characterLimit = 140;
            entry.onSubmit.AddListener(_ => Send());

            var send = ModernUiTheme.CreateButton(rect, "Send", "ส่ง",
                ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place(send, new Vector2(1, 0), new Vector2(-Pad, Pad), new Vector2(66f, EntryHeight));
            send.onClick.AddListener(Send);
        }

        // =====================================================================
        // Talking

        private void Send()
        {
            var text = entry != null ? entry.text : null;
            if (string.IsNullOrWhiteSpace(text))
                return;

            NetworkManager.Instance.SendWhisper(otherName, text.Trim());

            //Not written into the log here. The server sends the sender their own copy, so
            //writing it now would show every line twice - and worse, would show a line that
            //never left in the case the other person has just logged out.
            entry.text = string.Empty;
            FocusEntry();
        }

        private void Append(string speaker, string text, bool isMine)
        {
            var colour = isMine ? "#0B5C87" : "#1B6E3C";
            lines.Add($"<color={colour}><b>{speaker}</b></color>  {text}");

            if (lines.Count > MaxLines)
                lines.RemoveRange(0, lines.Count - MaxLines);

            log.text = string.Join("\n", lines);

            //Measured after the text is in, because a wrapped line is taller than a short
            //one and the height is the only thing telling the scroll view how far it goes.
            log.ForceMeshUpdate();
            var height = Mathf.Max(log.preferredHeight + 8f, 1f);
            body.sizeDelta = new Vector2(0, height);
            body.anchoredPosition = new Vector2(body.anchoredPosition.x, height);
        }

        private void FocusEntry()
        {
            if (entry == null)
                return;

            entry.ActivateInputField();
            entry.caretPosition = entry.text.Length;
        }

        public override void CloseWindow()
        {
            if (!string.IsNullOrEmpty(otherName))
                open.Remove(otherName);

            base.CloseWindow();
        }
    }
}
