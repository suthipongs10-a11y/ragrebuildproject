using System;
using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Guild
{
    /// <summary>
    /// The guild tab: who is in it, who is online, and the two things you can do about it.
    ///
    /// Everything shown here came off the wire. Membership lives in the database and is
    /// decided by the server, so this page only ever draws <see cref="GuildState"/> and
    /// sends requests; it never decides that somebody has left, only that the server said
    /// so. That is why leaving does not clear the roster locally — the answer that clears
    /// it is the same packet everyone else's window gets.
    ///
    /// Laid out by hand for the same reason the guide page is: the roster is a list of
    /// unknown length, and a layout group with a size fitter leaves the rect it drives at
    /// zero height until a layout pass has run on an active object. Rows are a fixed height
    /// and stacked on a running offset, which can be reasoned about without running it.
    /// </summary>
    public class GuildWindow : WindowBase
    {
        private const float Width = 524f;
        private const float Height = 404f;
        private const float Pad = 8f;

        private const float HeaderHeight = 52f;
        private const float ButtonRowHeight = 30f;
        private const float RowHeight = 30f;
        private const float RowGap = 3f;

        /// <summary>How big one emblem is in the picker, and the space around it.</summary>
        private const float EmblemCell = 46f;
        private const float EmblemGap = 6f;

        private const float DotSize = 9f;
        private const float NameLeft = 24f;
        private const float KickWidth = 54f;

        /// <summary>The server's own cap, kept here so the prompt can say it.</summary>
        private const int MaxTitleLength = 20;
        private const float AnswerWidth = 52f;
        private const float JoinWidth = 82f;
        private const float HeadingHeight = 22f;

        /// <summary>How often the roster is asked for again while the tab is on screen.</summary>
        private const float RefreshInterval = 6f;

        private static readonly Color OnlineColor = new Color(0.184f, 0.523f, 0.215f);
        private static readonly Color OfflineColor = new Color(0.604f, 0.643f, 0.690f);
        private static readonly Color LeaderColor = new Color(0.478f, 0.341f, 0.086f);
        private static readonly Color WarnColor = new Color(0.706f, 0.106f, 0.145f);
        private static readonly Color WarnCardColor = new Color(0.996f, 0.910f, 0.910f);

        /// <summary>The countdown line, kept so it can be retimed without redrawing the list.</summary>
        private TextMeshProUGUI cooldownNote;

        private RectTransform body;
        private TextMeshProUGUI title;
        private TextMeshProUGUI subtitle;
        private Button leaveButton;
        private Button titleButton;
        private Button emblemButton;

        /// <summary>Whether the roster has been swapped for the grid of emblems.</summary>
        private bool pickingEmblem;
        private Button browseButton;

        private readonly List<GameObject> rows = new List<GameObject>();

        private int drawnRevision = -1;
        private bool drawnWaiting;
        private float refreshTimer;

        public static GuildWindow Create(RectTransform parent)
        {
            var go = new GameObject("GuildWindow", typeof(RectTransform));
            go.SetActive(false);
            go.transform.SetParent(parent, false);

            var window = go.AddComponent<GuildWindow>();
            window.Build();
            return window;
        }

        private void Build()
        {
            var root = (RectTransform)transform;
            root.anchorMin = new Vector2(0, 1);
            root.anchorMax = new Vector2(0, 1);
            root.pivot = new Vector2(0, 1);
            root.sizeDelta = new Vector2(Width, Height);

            title = ModernUiTheme.CreateText(root, "GuildName", "", ModernUiTheme.SizeValue,
                ModernUiTheme.TitleColor, TextAlignmentOptions.TopLeft, FontStyles.Bold);
            ModernUiTheme.Place(title.rectTransform, new Vector2(0, 1), new Vector2(Pad + 2f, -2f),
                new Vector2(Width - Pad * 2f - 4f - KickWidth * 2f, 24f));

            subtitle = ModernUiTheme.CreateText(root, "GuildCount", "", ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Place(subtitle.rectTransform, new Vector2(0, 1), new Vector2(Pad + 2f, -26f),
                new Vector2(Width - Pad * 2f - 4f, 20f));

            leaveButton = ModernUiTheme.CreateButton(root, "Leave", "ออกจากกิลด์",
                ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)leaveButton.transform, new Vector2(1, 1),
                new Vector2(-Pad, -Pad), new Vector2(96f, ButtonRowHeight));
            ModernUiTheme.AddBorder((RectTransform)leaveButton.transform, ModernUiTheme.CardBorderColor);
            leaveButton.onClick.AddListener(ConfirmLeave);

            //Sits where the leave button sits, since the two are never both wanted: you are
            //either in a guild and might leave it, or you are not and might look for one.
            browseButton = ModernUiTheme.CreateButton(root, "Browse", "ค้นหากิลด์",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)browseButton.transform, new Vector2(1, 1),
                new Vector2(-Pad, -Pad), new Vector2(96f, ButtonRowHeight));
            browseButton.onClick.AddListener(() => Send(GuildRequestType.ListGuilds));

            //Sits where the other two sit, for the same reason: a leader cannot leave, so
            //the slot is free on exactly the screens where this belongs.
            titleButton = ModernUiTheme.CreateButton(root, "SetTitle", "ตั้งฉายา",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)titleButton.transform, new Vector2(1, 1),
                new Vector2(-Pad, -Pad), new Vector2(96f, ButtonRowHeight));
            titleButton.onClick.AddListener(AskForTitle);

            emblemButton = ModernUiTheme.CreateButton(root, "SetEmblem", "เลือกโลโก้",
                ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)emblemButton.transform, new Vector2(1, 1),
                new Vector2(-Pad - 100f, -Pad), new Vector2(96f, ButtonRowHeight));
            ModernUiTheme.AddBorder((RectTransform)emblemButton.transform, ModernUiTheme.CardBorderColor);
            emblemButton.onClick.AddListener(() =>
            {
                pickingEmblem = !pickingEmblem;
                Redraw();
            });

            //A sunken tray, which is also what catches the drag that scrolls it: the gaps
            //between the rows would otherwise pass the pointer straight through.
            var viewport = ModernUiTheme.CreateCard(transform, "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Stretch(viewport, Pad, Pad, -Pad, -HeaderHeight);
            viewport.gameObject.AddComponent<RectMask2D>();

            body = ModernUiTheme.CreateRect("Members", viewport);
            body.anchorMin = new Vector2(0, 1);
            body.anchorMax = new Vector2(1, 1);
            body.pivot = new Vector2(0.5f, 1);
            body.offsetMin = Vector2.zero;
            body.offsetMax = Vector2.zero;

            var scroll = gameObject.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = body;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 32f;
        }

        /// <summary>
        /// Asks for the roster whenever the tab comes up, so it is never showing what was
        /// true the last time it was looked at.
        /// </summary>
        private void OnEnable()
        {
            refreshTimer = 0f;
            drawnRevision = -1;
        }

        private void Update()
        {
            //Asked for again on a timer rather than pushed. Somebody joining or leaving is
            //announced to the guild in chat, but the roster behind that announcement is only
            //sent to the people the action touched; without this the window would sit on a
            //list that went stale the moment anybody else moved.
            refreshTimer -= Time.deltaTime;
            if (refreshTimer <= 0f)
            {
                refreshTimer = RefreshInterval;
                Send(GuildRequestType.Refresh);

                //Only worth asking while there is no guild to be in. Once there is one the
                //list is a page you never look at, and asking anyway would have the server
                //walk every loaded guild every six seconds for nobody.
                if (!GuildState.InGuild)
                    Send(GuildRequestType.ListGuilds);
            }

            //Retimed every frame rather than on the six second refresh, so it reads as a
            //countdown instead of a number that lurches. It is a subtraction against a
            //deadline the server already gave us, not a question asked again.
            if (cooldownNote != null)
                cooldownNote.text = CooldownText();

            //The list has to be redrawn once when the wait ends, or the join buttons stay
            //greyed out until something else happens to change the roster.
            var waiting = GuildState.RejoinSecondsLeft > 0;
            if (drawnWaiting != waiting)
            {
                drawnWaiting = waiting;
                drawnRevision = GuildState.Revision;
                Redraw();
                return;
            }

            if (drawnRevision == GuildState.Revision)
                return;

            drawnRevision = GuildState.Revision;
            Redraw();
        }

        private static void Send(GuildRequestType action)
        {
            var network = NetworkManager.Instance;
            if (network != null)
                network.SendGuildAction(action);
        }

        private static void Send(GuildRequestType action, string name)
        {
            var network = NetworkManager.Instance;
            if (network != null)
                network.SendGuildAction(action, name);
        }

        private static void Send(GuildRequestType action, int guildId)
        {
            var network = NetworkManager.Instance;
            if (network != null)
                network.SendGuildAction(action, guildId);
        }

        /// <summary>
        /// Asks first, for the two buttons that cannot be undone.
        ///
        /// Both sit in a list that is rebuilt every few seconds, on a screen small enough to
        /// tap by accident, and neither has a way back: the person kicked has to be let in
        /// again, and leaving costs a day before any guild will take you.
        ///
        /// If the prompt window is missing the action does not happen. A destructive thing
        /// going ahead without the question it was promised is worse than a button that
        /// appears not to work and leaves a line in the log.
        /// </summary>
        private static void Confirm(string question, Action onYes)
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.YesNoOptionsWindow == null)
            {
                Debug.LogError("[GuildWindow] No confirmation window, so the action was not carried out.");
                return;
            }

            ui.YesNoOptionsWindow.BeginPrompt(question, "ตกลง", "ยกเลิก", onYes, null, false);
        }

        /// <summary>
        /// Asks the leader what the guild should be called after its name.
        ///
        /// Sent empty to take it off again, which is why the prompt says so: a field you
        /// can only fill and never clear is one people end up leaving wrong.
        /// </summary>
        private void AskForTitle()
        {
            UiManager.Instance.TextInputWindow.BeginTextInput(
                $"ตั้งฉายากิลด์ (ไม่เกิน {MaxTitleLength} ตัวอักษร — เว้นว่างเพื่อลบ)",
                text =>
                {
                    text = text == null ? "" : text.Trim();

                    //The server checks this again and refuses; this is so a long one is not
                    //silently cut down to something the leader did not choose.
                    if (text.Length > MaxTitleLength)
                    {
                        CameraFollower.Instance.AppendError(
                            $"ฉายายาวได้ไม่เกิน {MaxTitleLength} ตัวอักษร");
                        return;
                    }

                    NetworkManager.Instance.SendGuildAction(GuildRequestType.SetTitle, text);
                });
        }

        private void ConfirmLeave()
        {
            //The wait is the part worth saying out loud. Leaving is the obvious half; that it
            //locks you out of every other guild for a day is the half nobody expects, and
            //finding out afterwards is exactly the wrong time.
            Confirm($"ออกจากกิลด์ {GuildState.GuildName} ใช่ไหม?\n\n"
                    + "ออกแล้วจะเข้ากิลด์อื่นไม่ได้จนกว่าจะครบ 24 ชั่วโมง",
                () => Send(GuildRequestType.Leave));
        }

        private void Redraw()
        {
            ClearRows();

            if (!GuildState.InGuild)
            {
                title.text = "ยังไม่ได้อยู่ในกิลด์";
                subtitle.text = "สร้างกิลด์ด้วย  /guild create <ชื่อกิลด์>  หรือขอเข้ากิลด์ข้างล่าง";
                leaveButton.gameObject.SetActive(false);
                browseButton.gameObject.SetActive(true);
                DrawBrowse();
                return;
            }

            browseButton.gameObject.SetActive(false);

            //The title is shown the way everyone else sees it, so the leader is setting the
            //thing they are looking at rather than a field whose effect is somewhere else.
            title.text = string.IsNullOrWhiteSpace(GuildState.GuildTitle)
                ? GuildState.GuildName
                : $"{GuildState.GuildName}  <size=-4>~{GuildState.GuildTitle}~</size>";

            var online = 0;
            foreach (var member in GuildState.Members)
            {
                if (member.IsOnline)
                    online++;
            }

            subtitle.text = $"สมาชิก {GuildState.Members.Count}/{GuildState.MaxMembers}  ·  ออนไลน์ {online}";

            //The leader cannot leave, so the button would be a thing that only ever produces
            //a refusal. The server refuses it anyway; this is so it is not offered.
            leaveButton.gameObject.SetActive(!GuildState.IsLeader);
            titleButton.gameObject.SetActive(GuildState.IsLeader && !pickingEmblem);
            emblemButton.gameObject.SetActive(GuildState.IsLeader);

            var emblemLabel = emblemButton.GetComponentInChildren<TextMeshProUGUI>();
            if (emblemLabel != null)
                emblemLabel.text = pickingEmblem ? "ย้อนกลับ" : "เลือกโลโก้";

            //Only a leader has the button, so only a leader can be in the grid - but the
            //flag survives losing the guild, and a grid over an empty roster would be a
            //page nothing can get out of.
            if (pickingEmblem && !GuildState.IsLeader)
                pickingEmblem = false;

            if (pickingEmblem)
            {
                DrawEmblemPicker();
                return;
            }

            var y = -RowGap;

            //Above the roster rather than behind a button. Somebody waiting to be let in is
            //the only thing on this page that is waiting on the person reading it, and a
            //queue you have to go looking for is a queue nobody answers.
            if (GuildState.IsLeader && GuildState.JoinRequests.Count > 0)
            {
                BuildHeading($"คำขอเข้ากิลด์  ({GuildState.JoinRequests.Count})", y);
                y -= HeadingHeight;

                foreach (var applicant in GuildState.JoinRequests)
                {
                    BuildRequestRow(applicant, y);
                    y -= RowHeight + RowGap;
                }

                BuildHeading("สมาชิก", y - RowGap);
                y -= HeadingHeight + RowGap;
            }

            for (var i = 0; i < GuildState.Members.Count; i++)
            {
                BuildRow(GuildState.Members[i], y);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        /// <summary>
        /// The guilds you could ask to join.
        ///
        /// Which is not every guild that exists, and the note says so. The server can only
        /// list the guilds it has in memory, and one whose members are all offline was never
        /// loaded — so a guild missing from here is not a guild that is gone, it is one with
        /// nobody around to answer you anyway.
        /// </summary>
        private void DrawBrowse()
        {
            var y = -RowGap;

            //Above everything, in red, because it is the answer to the question the rest of
            //the page invites. Being told in chat after tapping is being told too late, and
            //the chat line scrolls away while the wait does not.
            if (GuildState.RejoinSecondsLeft > 0)
            {
                var banner = ModernUiTheme.CreateCard(body, "Cooldown", WarnCardColor);
                banner.anchorMin = new Vector2(0, 1);
                banner.anchorMax = new Vector2(1, 1);
                banner.pivot = new Vector2(0.5f, 1);
                banner.sizeDelta = new Vector2(-RowGap * 2f, RowHeight + 12f);
                banner.anchoredPosition = new Vector2(0, y);
                banner.GetComponent<Image>().raycastTarget = false;
                ModernUiTheme.AddBorder(banner, WarnColor);
                rows.Add(banner.gameObject);

                cooldownNote = ModernUiTheme.CreateText(banner, "Wait", CooldownText(),
                    ModernUiTheme.SizeLabel, WarnColor, TextAlignmentOptions.Left, FontStyles.Bold);
                ModernUiTheme.Stretch(cooldownNote.rectTransform, 10f, 2f, -10f, -2f);

                y -= RowHeight + 12f + RowGap;
            }

            if (!GuildState.BrowseReceived)
            {
                BuildNote("กำลังโหลดรายชื่อกิลด์...", y);
                body.sizeDelta = new Vector2(0, RowHeight * 2f);
                return;
            }

            if (GuildState.Browse.Count == 0)
            {
                BuildNote("ยังไม่มีกิลด์ที่เข้าได้ตอนนี้", y);
                BuildNote("กิลด์จะขึ้นเมื่อมีสมาชิกออนไลน์อยู่", y - HeadingHeight);
                body.sizeDelta = new Vector2(0, RowHeight * 3f);
                return;
            }

            BuildHeading($"กิลด์ในเซิร์ฟเวอร์  ({GuildState.Browse.Count})", y);
            y -= HeadingHeight;

            foreach (var entry in GuildState.Browse)
            {
                BuildGuildRow(entry, y);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        /// <summary>A row for one guild, with the one thing you can do about it.</summary>
        private void BuildGuildRow(GuildBrowseEntry entry, float y)
        {
            var row = NewRow(y);

            var full = entry.MemberCount >= GuildState.MaxMembers;

            var name = ModernUiTheme.CreateText(row, "Name", entry.Name,
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.Left,
                FontStyles.Bold);
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(12f, 0f), new Vector2(240f, RowHeight));

            var count = ModernUiTheme.CreateText(row, "Count",
                $"{entry.MemberCount}/{GuildState.MaxMembers}" + (full ? "  เต็ม" : ""),
                ModernUiTheme.SizeLabel,
                full ? ModernUiTheme.MutedColor : ModernUiTheme.LabelColor,
                TextAlignmentOptions.Left);
            ModernUiTheme.Place(count.rectTransform, new Vector2(0, 0.5f),
                new Vector2(258f, 0f), new Vector2(120f, RowHeight));

            //Asked already, still serving out the wait, or nowhere to put you: in every case
            //the button could only produce a refusal, so it says why instead of offering.
            var waiting = GuildState.RejoinSecondsLeft > 0;
            if (entry.AlreadyAsked || full || waiting)
            {
                var reason = waiting ? "รออยู่" : entry.AlreadyAsked ? "ส่งคำขอแล้ว" : "-";
                var said = ModernUiTheme.CreateText(row, "Asked", reason,
                    ModernUiTheme.SizeLabel, waiting ? WarnColor : ModernUiTheme.MutedColor,
                    TextAlignmentOptions.Right);
                ModernUiTheme.Place(said.rectTransform, new Vector2(1, 0.5f),
                    new Vector2(-10f, 0f), new Vector2(JoinWidth + 10f, RowHeight));
                return;
            }

            var join = ModernUiTheme.CreateButton(row, "Join", "ขอเข้าร่วม",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)join.transform, new Vector2(1, 0.5f),
                new Vector2(-6f, 0f), new Vector2(JoinWidth, RowHeight - 6f));

            //captured now, because the row is thrown away and rebuilt on the next refresh
            var id = entry.GuildId;
            join.onClick.AddListener(() => Send(GuildRequestType.RequestJoin, id));
        }

        /// <summary>Somebody asking to be let in, and the two answers.</summary>
        private void BuildRequestRow(string applicant, float y)
        {
            var row = NewRow(y);

            var name = ModernUiTheme.CreateText(row, "Name", applicant,
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.Left,
                FontStyles.Bold);
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(12f, 0f), new Vector2(240f, RowHeight));

            var target = applicant;

            var reject = ModernUiTheme.CreateButton(row, "Reject", "ปฏิเสธ",
                ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)reject.transform, new Vector2(1, 0.5f),
                new Vector2(-6f, 0f), new Vector2(AnswerWidth, RowHeight - 6f));
            reject.onClick.AddListener(() => Send(GuildRequestType.RejectRequest, target));

            var accept = ModernUiTheme.CreateButton(row, "Accept", "รับเข้า",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)accept.transform, new Vector2(1, 0.5f),
                new Vector2(-(AnswerWidth + 12f), 0f), new Vector2(AnswerWidth, RowHeight - 6f));
            accept.onClick.AddListener(() => Send(GuildRequestType.ApproveRequest, target));
        }

        /// <summary>
        /// Every emblem there is, as a grid, with the one in use marked.
        ///
        /// In place of the roster rather than in a window of its own: it is a choice made
        /// once and looked at while it is being made, and a second floating window on a
        /// phone is a window covering the one you were reading.
        /// </summary>
        private void DrawEmblemPicker()
        {
            //the tray is the window less its padding, less the row's own inset
            var inner = Width - Pad * 2f - RowGap * 2f;
            var columns = Mathf.Max(1, Mathf.FloorToInt((inner + EmblemGap) / (EmblemCell + EmblemGap)));
            var used = columns * EmblemCell + (columns - 1) * EmblemGap;
            var left = (inner - used) * 0.5f;

            BuildHeading("เลือกโลโก้กิลด์  ·  แตะเพื่อใช้เลย", -RowGap);

            var top = -RowGap - HeadingHeight - RowGap;
            var count = GuildEmblems.MaxId + 1; //0 is "no emblem", and is a choice too

            for (var id = 0; id < count; id++)
            {
                var column = id % columns;
                var row = id / columns;

                BuildEmblemCell(id, left + column * (EmblemCell + EmblemGap),
                    top - row * (EmblemCell + EmblemGap));
            }

            //not called "rows": that is the field holding everything drawn, and shadowing it
            //here would compile and then quietly clear the wrong thing on the next redraw
            var lines = Mathf.CeilToInt(count / (float)columns);
            body.sizeDelta = new Vector2(0, -top + lines * (EmblemCell + EmblemGap) + RowGap);
        }

        private void BuildEmblemCell(int id, float x, float y)
        {
            var chosen = GuildState.EmblemId == id;

            var cell = ModernUiTheme.CreateCard(body, "Emblem" + id,
                chosen ? ModernUiTheme.AccentColor : ModernUiTheme.WindowColor);
            cell.anchorMin = new Vector2(0, 1);
            cell.anchorMax = new Vector2(0, 1);
            cell.pivot = new Vector2(0, 1);
            cell.sizeDelta = new Vector2(EmblemCell, EmblemCell);
            cell.anchoredPosition = new Vector2(RowGap + x, y);
            rows.Add(cell.gameObject);

            var button = cell.gameObject.AddComponent<Button>();
            button.targetGraphic = cell.GetComponent<Image>();
            cell.GetComponent<Image>().raycastTarget = true;
            button.onClick.AddListener(() =>
            {
                NetworkManager.Instance.SendGuildAction(GuildRequestType.SetEmblem, id);
                //drawn as chosen straight away; the server's answer redraws it either way
                GuildState.EmblemId = id;
                Redraw();
            });

            var sprite = GuildEmblems.Sprite(id);
            if (sprite == null)
            {
                //"no emblem" is a cell like any other, so taking one off is as easy as
                //putting one on
                var none = ModernUiTheme.CreateText(cell, "None", "ไม่ใส่", ModernUiTheme.SizeSmall,
                    chosen ? ModernUiTheme.LightInkColor : ModernUiTheme.MutedColor,
                    TextAlignmentOptions.Center);
                ModernUiTheme.Stretch(none.rectTransform, 2, 2, -2, -2);
                return;
            }

            var icon = ModernUiTheme.CreateIcon(cell, sprite, Color.white, EmblemCell - 10f);
        }

        private void BuildHeading(string text, float y)
        {
            var label = ModernUiTheme.CreateText(body, "Heading", text,
                ModernUiTheme.SizeLabel, ModernUiTheme.LabelColor, TextAlignmentOptions.Left,
                FontStyles.Bold);
            var rect = label.rectTransform;
            rect.anchorMin = new Vector2(0, 1);
            rect.anchorMax = new Vector2(1, 1);
            rect.pivot = new Vector2(0.5f, 1);
            rect.sizeDelta = new Vector2(-24f, HeadingHeight);
            rect.anchoredPosition = new Vector2(0, y);
            rows.Add(label.gameObject);
        }

        private void BuildNote(string text, float y)
        {
            var label = ModernUiTheme.CreateText(body, "Note", text,
                ModernUiTheme.SizeLabel, ModernUiTheme.MutedColor, TextAlignmentOptions.Left);
            var rect = label.rectTransform;
            rect.anchorMin = new Vector2(0, 1);
            rect.anchorMax = new Vector2(1, 1);
            rect.pivot = new Vector2(0.5f, 1);
            rect.sizeDelta = new Vector2(-24f, HeadingHeight);
            rect.anchoredPosition = new Vector2(0, y);
            rows.Add(label.gameObject);
        }

        /// <summary>The card every row of every list is drawn on.</summary>
        private RectTransform NewRow(float y)
        {
            var row = ModernUiTheme.CreateCard(body, "Row", ModernUiTheme.WindowColor);
            row.anchorMin = new Vector2(0, 1);
            row.anchorMax = new Vector2(1, 1);
            row.pivot = new Vector2(0.5f, 1);
            row.sizeDelta = new Vector2(-RowGap * 2f, RowHeight);
            row.anchoredPosition = new Vector2(0, y);
            row.GetComponent<Image>().raycastTarget = false;
            rows.Add(row.gameObject);
            return row;
        }

        private void BuildRow(GuildMemberInfo member, float y)
        {
            var row = NewRow(y);
            //Online or not is the one thing worth seeing without reading, because it decides
            //whether there is any point typing to them.
            var dot = ModernUiTheme.CreateCard(row, "Dot",
                member.IsOnline ? OnlineColor : OfflineColor);
            ModernUiTheme.Place(dot, new Vector2(0, 0.5f),
                new Vector2(9f, 0f), new Vector2(DotSize, DotSize));

            var nameColor = member.IsLeader ? LeaderColor : ModernUiTheme.NameColor;
            var name = ModernUiTheme.CreateText(row, "Name",
                member.IsLeader ? $"{member.Name}  (หัวกิลด์)" : member.Name,
                ModernUiTheme.SizeLabel, nameColor, TextAlignmentOptions.Left,
                member.IsLeader ? FontStyles.Bold : FontStyles.Normal);
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(NameLeft, 0f), new Vector2(210f, RowHeight));

            //A member who has not been seen since the server came up has no job or level
            //recorded, and showing that as level zero would be a lie rather than a gap.
            var detail = member.HasDetails
                ? $"{JobName(member.Job)}   Lv.{member.Level}"
                : "-";

            var info = ModernUiTheme.CreateText(row, "Detail", detail,
                ModernUiTheme.SizeLabel, ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            ModernUiTheme.Place(info.rectTransform, new Vector2(0, 0.5f),
                new Vector2(NameLeft + 214f, 0f), new Vector2(170f, RowHeight));

            if (!GuildState.IsLeader || member.IsLeader)
                return;

            var kick = ModernUiTheme.CreateButton(row, "Kick", "ไล่ออก",
                ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)kick.transform, new Vector2(1, 0.5f),
                new Vector2(-6f, 0f), new Vector2(KickWidth, RowHeight - 6f));

            //captured now, because the row is thrown away and rebuilt on the next refresh
            var target = member.Name;
            kick.onClick.AddListener(() =>
                Confirm($"ไล่ {target} ออกจากกิลด์ใช่ไหม?", () => Send(GuildRequestType.Kick, target)));
        }

        private static string JobName(int job)
        {
            var data = ClientDataLoader.Instance;
            if (data == null || job < 0)
                return "-";
            return data.GetJobNameForId(job);
        }

        private static string CooldownText() =>
            $"เพิ่งออกจากกิลด์ — เข้ากิลด์ใหม่ได้อีกใน {GuildState.DescribeRejoinWait()}";

        private void ClearRows()
        {
            //it is one of the rows about to be destroyed, and a reference to a destroyed
            //label is a null check every frame away from an exception
            cooldownNote = null;

            foreach (var row in rows)
            {
                if (row == null)
                    continue;

                //Destroy does not take effect until the end of the frame, so the old rows
                //would be drawn under the new ones for a frame without this.
                row.SetActive(false);
                Destroy(row);
            }

            rows.Clear();
        }
    }
}
