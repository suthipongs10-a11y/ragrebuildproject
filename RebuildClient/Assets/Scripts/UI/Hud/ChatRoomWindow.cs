using Assets.Scripts.Network;
using RebuildSharedData.Networking;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// Opening a chat room, and getting into one that asked for a password.
    /// </summary>
    /// <remarks>
    /// The rooms themselves are old - the server has had them since vending shops did, and
    /// they were reachable by typing "/chat some title" into the chat bar. That is the part
    /// that was missing rather than the feature: a room is a thing you set up, with a name
    /// and a size and sometimes a key, and none of that fits in a command you have to know
    /// the spelling of before you can use it at all. On a phone, where the chat bar is a
    /// soft keyboard over half the screen, it was effectively not there.
    ///
    /// It talks to the server over the command the chat bar already used, with the fields
    /// packed into the one string it carries. A new packet would be a new value in an enum
    /// the client only sees as a compiled library, so it would not exist on this side until
    /// somebody remembered to copy that library across - and the error when they forget
    /// names a missing enum member rather than the thing that is actually wrong. Nothing
    /// here needs that, so nothing here does it.
    ///
    /// Built in code like the rest of the rebuilt windows, so the shared scene is untouched.
    /// </remarks>
    public class ChatRoomWindow : WindowBase
    {
        private const float Width = 420f;
        private const float Height = 336f;
        private const float Pad = 12f;
        private const float RowHeight = 34f;
        private const float LabelWidth = 104f;

        /// <summary>Matches the server's own limits, so the window cannot ask for a refusal.</summary>
        private const int MinLimit = 2;
        private const int MaxLimit = 20;
        private const int MaxTitleLength = 32;
        private const int MaxPasswordLength = 16;

        /// <summary>
        /// The one character the request is split on, shared with the server's reader.
        /// Nothing a keyboard produces, so a title can hold anything at all.
        /// </summary>
        private const char Separator = '\u001f';

        private static ChatRoomWindow instance;

        private RectTransform createGroup;
        private RectTransform joinGroup;

        private TMP_InputField titleField;
        private TMP_InputField passwordField;
        private TMP_InputField joinPasswordField;
        private TextMeshProUGUI limitLabel;
        private TextMeshProUGUI joinTitleLabel;
        private TextMeshProUGUI hint;

        private int limit = MaxLimit;
        private int joinNpcId;

        // =====================================================================
        // Ways in

        public static void Open()
        {
            if (instance == null)
                instance = Build();
            if (instance == null)
                return;

            instance.ShowCreate();
            instance.gameObject.SetActive(true);
            instance.MoveToTop();
        }

        public static void Toggle()
        {
            if (instance != null && instance.gameObject.activeSelf)
            {
                instance.CloseWindow();
                return;
            }

            Open();
        }

        /// <summary>
        /// Asks for the key to a room whose sign says it has one.
        /// </summary>
        /// <remarks>
        /// The sign is the only thing the client is told about a room it has not joined, so
        /// this is driven by the sign: the title arrives with a marker on the front of it,
        /// and the marker is what says to ask here rather than knock directly.
        /// </remarks>
        public static void OpenForJoin(int npcId, string title)
        {
            if (instance == null)
                instance = Build();
            if (instance == null)
                return;

            instance.joinNpcId = npcId;
            instance.ShowJoin(title);
            instance.gameObject.SetActive(true);
            instance.MoveToTop();

            if (instance.joinPasswordField != null)
            {
                instance.joinPasswordField.text = "";
                instance.joinPasswordField.ActivateInputField();
            }
        }

        // =====================================================================
        // Building

        private static ChatRoomWindow Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            //assembled inactive so nothing runs against a half built window
            var host = new GameObject("ChatRoomWindow", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<ChatRoomWindow>();
            window.CanCloseWithEscape = true;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, ThaiUiText.Get("ChatRoom"), "", ModernUiIcons.Person);
            ModernUiTheme.AttachShadow(rect);

            window.BuildCreatePage(rect);
            window.BuildJoinPage(rect);

            host.SetActive(true);
            return window;
        }

        private void BuildCreatePage(RectTransform rect)
        {
            createGroup = ModernUiTheme.CreateRect("Create", rect);
            ModernUiTheme.Stretch(createGroup, 0f, 0f, 0f, -ModernUiTheme.TitleBarHeight);

            var y = -Pad;

            y = Row(createGroup, y, "ชื่อห้อง", out var titleCard);
            titleField = MakeField(titleCard, MaxTitleLength, false, "ตั้งชื่อห้องของคุณ");

            //A number with two buttons rather than a slider: a slider on a phone is a thing
            //you drag past the value you wanted, and there are only nineteen of them.
            y = Row(createGroup, y, "รับได้กี่คน", out var limitCard);
            limitLabel = ModernUiTheme.CreateText(limitCard, "Limit", limit.ToString(),
                ModernUiTheme.SizeBody, ModernUiTheme.NameColor, TextAlignmentOptions.Center);
            ModernUiTheme.Stretch(limitLabel.rectTransform, 44f, 0f, -44f, 0f);

            var less = ModernUiTheme.CreateButton(limitCard, "Less", "-",
                ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeBody);
            ModernUiTheme.Place((RectTransform)less.transform, new Vector2(0, 0.5f),
                new Vector2(3f, 0f), new Vector2(38f, RowHeight - 6f));
            less.onClick.AddListener(() => StepLimit(-1));

            var more = ModernUiTheme.CreateButton(limitCard, "More", "+",
                ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeBody);
            ModernUiTheme.Place((RectTransform)more.transform, new Vector2(1, 0.5f),
                new Vector2(-3f, 0f), new Vector2(38f, RowHeight - 6f));
            more.onClick.AddListener(() => StepLimit(1));

            y = Row(createGroup, y, "รหัสผ่าน", out var passCard);
            passwordField = MakeField(passCard, MaxPasswordLength, true, "เว้นว่าง = ใครก็เข้าได้");

            hint = ModernUiTheme.CreateText(createGroup, "Hint",
                "ห้องจะตั้งอยู่ตรงที่คุณยืน คนอื่นคลิกป้ายเพื่อเข้าห้อง เดินออกไปห้องจะปิดเอง",
                ModernUiTheme.SizeSmall, ModernUiTheme.HintColor, TextAlignmentOptions.TopLeft);
            hint.textWrappingMode = TextWrappingModes.Normal;
            ModernUiTheme.Place(hint.rectTransform, new Vector2(0, 1),
                new Vector2(Pad, y - 6f), new Vector2(Width - Pad * 2f, 40f));

            var open = ModernUiTheme.CreateButton(createGroup, "Open", "เปิดห้องแชท",
                ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeBody);
            ModernUiTheme.Place((RectTransform)open.transform, new Vector2(0, 0),
                new Vector2(Pad, Pad), new Vector2(Width * 0.56f - Pad * 1.5f, 38f));
            open.onClick.AddListener(CreateRoom);

            //Always offered rather than shown only when you are in a room: the client is
            //never told that it is. The server refuses politely when there is nothing to
            //leave, which costs a line of chat and no state to keep in step.
            var leave = ModernUiTheme.CreateButton(createGroup, "Leave", "ออก / ปิดห้อง",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeBody);
            ModernUiTheme.Place((RectTransform)leave.transform, new Vector2(1, 0),
                new Vector2(-Pad, Pad), new Vector2(Width * 0.44f - Pad * 1.5f, 38f));
            leave.onClick.AddListener(LeaveRoom);
        }

        private void BuildJoinPage(RectTransform rect)
        {
            joinGroup = ModernUiTheme.CreateRect("Join", rect);
            ModernUiTheme.Stretch(joinGroup, 0f, 0f, 0f, -ModernUiTheme.TitleBarHeight);
            joinGroup.gameObject.SetActive(false);

            joinTitleLabel = ModernUiTheme.CreateText(joinGroup, "RoomName", "",
                ModernUiTheme.SizeBody, ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft,
                FontStyles.Bold);
            joinTitleLabel.textWrappingMode = TextWrappingModes.Normal;
            ModernUiTheme.Place(joinTitleLabel.rectTransform, new Vector2(0, 1),
                new Vector2(Pad, -Pad), new Vector2(Width - Pad * 2f, 46f));

            var y = -(Pad + 52f);
            y = Row(joinGroup, y, "รหัสผ่าน", out var passCard);
            joinPasswordField = MakeField(passCard, MaxPasswordLength, true, "ใส่รหัสของห้อง");
            joinPasswordField.onSubmit.AddListener(_ => JoinRoom());

            var note = ModernUiTheme.CreateText(joinGroup, "Note",
                "ห้องนี้ใส่รหัสไว้ ถามเจ้าของห้องก่อนนะ",
                ModernUiTheme.SizeSmall, ModernUiTheme.HintColor, TextAlignmentOptions.TopLeft);
            note.textWrappingMode = TextWrappingModes.Normal;
            ModernUiTheme.Place(note.rectTransform, new Vector2(0, 1),
                new Vector2(Pad, y - 6f), new Vector2(Width - Pad * 2f, 40f));

            var enter = ModernUiTheme.CreateButton(joinGroup, "Enter", "เข้าห้อง",
                ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeBody);
            ModernUiTheme.Place((RectTransform)enter.transform, new Vector2(0, 0),
                new Vector2(Pad, Pad), new Vector2(Width * 0.56f - Pad * 1.5f, 38f));
            enter.onClick.AddListener(JoinRoom);

            var back = ModernUiTheme.CreateButton(joinGroup, "Back", "ยกเลิก",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeBody);
            ModernUiTheme.Place((RectTransform)back.transform, new Vector2(1, 0),
                new Vector2(-Pad, Pad), new Vector2(Width * 0.44f - Pad * 1.5f, 38f));
            back.onClick.AddListener(CloseWindow);
        }

        /// <summary>
        /// One labelled row, returning the top of the next one and handing back the tray the
        /// row's control goes in.
        /// </summary>
        private static float Row(RectTransform parent, float top, string label, out RectTransform card)
        {
            var text = ModernUiTheme.CreateText(parent, label, label, ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            ModernUiTheme.Place(text.rectTransform, new Vector2(0, 1),
                new Vector2(Pad, top), new Vector2(LabelWidth, RowHeight));

            card = ModernUiTheme.CreateCard(parent, label + "Field", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Place(card, new Vector2(0, 1),
                new Vector2(Pad + LabelWidth, top), new Vector2(Width - Pad * 2f - LabelWidth, RowHeight));

            return top - (RowHeight + 8f);
        }

        private static TMP_InputField MakeField(RectTransform card, int length, bool secret, string placeholder)
        {
            var text = ModernUiTheme.CreateText(card, "Text", "", ModernUiTheme.SizeBody,
                ModernUiTheme.NameColor, TextAlignmentOptions.Left);
            ModernUiTheme.Stretch(text.rectTransform, 10f, 3f, -10f, -3f);
            text.raycastTarget = true;

            var ghost = ModernUiTheme.CreateText(card, "Placeholder", placeholder, ModernUiTheme.SizeSmall,
                ModernUiTheme.HintColor, TextAlignmentOptions.Left);
            ModernUiTheme.Stretch(ghost.rectTransform, 10f, 3f, -10f, -3f);

            var field = card.gameObject.AddComponent<TMP_InputField>();
            field.textComponent = text;
            field.textViewport = card;
            field.placeholder = ghost;
            field.lineType = TMP_InputField.LineType.SingleLine;
            field.characterLimit = length;
            if (secret)
                field.contentType = TMP_InputField.ContentType.Password;
            ModernUiTheme.StyleInputField(field);
            return field;
        }

        // =====================================================================
        // Pages

        private void ShowCreate()
        {
            if (createGroup != null)
                createGroup.gameObject.SetActive(true);
            if (joinGroup != null)
                joinGroup.gameObject.SetActive(false);
        }

        private void ShowJoin(string title)
        {
            if (createGroup != null)
                createGroup.gameObject.SetActive(false);
            if (joinGroup != null)
                joinGroup.gameObject.SetActive(true);
            if (joinTitleLabel != null)
                joinTitleLabel.text = title;
        }

        private void StepLimit(int step)
        {
            limit = Mathf.Clamp(limit + step, MinLimit, MaxLimit);
            if (limitLabel != null)
                limitLabel.text = limit.ToString();
        }

        // =====================================================================
        // Talking to the server

        private void CreateRoom()
        {
            var network = NetworkManager.Instance;
            if (network == null || titleField == null)
                return;

            var title = titleField.text == null ? "" : titleField.text.Trim();
            if (string.IsNullOrEmpty(title))
            {
                //nothing is sent for an empty name, so the refusal never has to travel
                if (hint != null)
                    hint.text = "ต้องตั้งชื่อห้องก่อนถึงจะเปิดได้";
                titleField.ActivateInputField();
                return;
            }

            var password = passwordField != null && passwordField.text != null ? passwordField.text : "";
            network.SendClientTextCommand(ClientTextCommand.ChatRoom,
                "c" + Separator + title + Separator + limit + Separator + password);
            CloseWindow();
        }

        private void JoinRoom()
        {
            var network = NetworkManager.Instance;
            if (network == null)
                return;

            var password = joinPasswordField != null && joinPasswordField.text != null
                ? joinPasswordField.text
                : "";
            network.SendClientTextCommand(ClientTextCommand.ChatRoom,
                "j" + Separator + joinNpcId + Separator + password);
            CloseWindow();
        }

        private void LeaveRoom()
        {
            var network = NetworkManager.Instance;
            if (network == null)
                return;

            //bare, which is what the chat command has always sent to leave or close
            network.SendClientTextCommand(ClientTextCommand.ChatRoom, "");
            CloseWindow();
        }
    }
}
