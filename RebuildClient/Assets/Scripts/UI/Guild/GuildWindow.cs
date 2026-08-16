using System.Collections.Generic;
using Assets.Scripts.Network;
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

        private const float DotSize = 9f;
        private const float NameLeft = 24f;
        private const float KickWidth = 54f;

        /// <summary>How often the roster is asked for again while the tab is on screen.</summary>
        private const float RefreshInterval = 6f;

        private static readonly Color OnlineColor = new Color(0.184f, 0.523f, 0.215f);
        private static readonly Color OfflineColor = new Color(0.604f, 0.643f, 0.690f);
        private static readonly Color LeaderColor = new Color(0.478f, 0.341f, 0.086f);

        private RectTransform body;
        private TextMeshProUGUI title;
        private TextMeshProUGUI subtitle;
        private Button leaveButton;

        private readonly List<GameObject> rows = new List<GameObject>();

        private int drawnRevision = -1;
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
            leaveButton.onClick.AddListener(() => Send(GuildRequestType.Leave));

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

        private void Redraw()
        {
            ClearRows();

            if (!GuildState.InGuild)
            {
                title.text = "ยังไม่ได้อยู่ในกิลด์";
                subtitle.text = "สร้างกิลด์ด้วยคำสั่ง  /guild create <ชื่อกิลด์>";
                leaveButton.gameObject.SetActive(false);
                body.sizeDelta = new Vector2(0, 0);
                return;
            }

            title.text = GuildState.GuildName;

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

            var y = -RowGap;
            for (var i = 0; i < GuildState.Members.Count; i++)
            {
                BuildRow(GuildState.Members[i], y);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        private void BuildRow(GuildMemberInfo member, float y)
        {
            var row = ModernUiTheme.CreateCard(body, "Member", ModernUiTheme.WindowColor);
            //Stretched across the tray and positioned by its top edge: sizeDelta.x of minus
            //twice the gap is an inset on both sides once the anchors span the full width.
            row.anchorMin = new Vector2(0, 1);
            row.anchorMax = new Vector2(1, 1);
            row.pivot = new Vector2(0.5f, 1);
            row.sizeDelta = new Vector2(-RowGap * 2f, RowHeight);
            row.anchoredPosition = new Vector2(0, y);
            rows.Add(row.gameObject);

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
            kick.onClick.AddListener(() => Send(GuildRequestType.Kick, target));
        }

        private static string JobName(int job)
        {
            var data = ClientDataLoader.Instance;
            if (data == null || job < 0)
                return "-";
            return data.GetJobNameForId(job);
        }

        private void ClearRows()
        {
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
