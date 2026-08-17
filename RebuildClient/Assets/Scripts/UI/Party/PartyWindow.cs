using System.Collections.Generic;
using System.Text;
using Assets.Scripts.Data;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Party
{
    /// <summary>
    /// The party tab: who is in it, what they are, and how the experience is being split.
    ///
    /// The game has had parties and shared experience since long before it had anywhere to
    /// look at either. Everything was in chat — you were told who joined as it happened and
    /// nowhere afterwards — so this is the page that answers "who is actually here" without
    /// scrolling back through a fight.
    ///
    /// Nothing here is worked out locally. The roster lives on the server and arrives in
    /// <see cref="PlayerState"/>; this draws that and sends requests. The kill counts in
    /// particular are the server's tally, not one kept here, because a client only ever sees
    /// the monsters that died near it.
    ///
    /// Laid out by hand for the same reason the guild page is: the roster is a list of
    /// unknown length, and a layout group with a size fitter leaves the rect it drives at
    /// zero height until a layout pass has run on an active object.
    /// </summary>
    public class PartyWindow : WindowBase
    {
        private const float Width = 524f;
        private const float Height = 404f;
        private const float Pad = 8f;

        private const float HeaderHeight = 52f;
        private const float ButtonRowHeight = 30f;
        private const float RowHeight = 30f;
        private const float RowGap = 3f;
        private const float HeadingHeight = 22f;

        private const float DotSize = 9f;
        private const float NameLeft = 24f;
        private const float NameWidth = 186f;
        private const float DetailLeft = 216f;
        private const float DetailWidth = 168f;
        private const float KillsWidth = 96f;
        private const float ShareWidth = 168f;

        /// <summary>
        /// How often the roster is asked for again while the tab is on screen.
        ///
        /// Kill counts move with every monster and the server does not push them — a packet
        /// per kill to everybody, for a number nobody is looking at unless this page is open,
        /// would be a lot of traffic for a column. So the page asks, and only while it is up.
        /// </summary>
        private const float RefreshInterval = 4f;

        private static readonly Color OnlineColor = new Color(0.184f, 0.523f, 0.215f);
        private static readonly Color OfflineColor = new Color(0.604f, 0.643f, 0.690f);
        private static readonly Color LeaderColor = new Color(0.478f, 0.341f, 0.086f);
        private static readonly Color MeCardColor = new Color(0.894f, 0.929f, 0.973f);

        private RectTransform body;
        private TextMeshProUGUI title;
        private TextMeshProUGUI subtitle;
        private Button shareButton;
        private TextMeshProUGUI shareNote;

        private readonly List<GameObject> rows = new List<GameObject>();

        private string drawnSignature;
        private float refreshTimer;

        public static PartyWindow Create(RectTransform parent)
        {
            var go = new GameObject("PartyWindow", typeof(RectTransform));
            go.SetActive(false);
            go.transform.SetParent(parent, false);

            var window = go.AddComponent<PartyWindow>();
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

            title = ModernUiTheme.CreateText(root, "PartyName", "", ModernUiTheme.SizeValue,
                ModernUiTheme.TitleColor, TextAlignmentOptions.TopLeft, FontStyles.Bold);
            ModernUiTheme.Place(title.rectTransform, new Vector2(0, 1), new Vector2(Pad + 2f, -2f),
                new Vector2(Width - Pad * 2f - 4f - ShareWidth, 24f));

            subtitle = ModernUiTheme.CreateText(root, "PartyCount", "", ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Place(subtitle.rectTransform, new Vector2(0, 1), new Vector2(Pad + 2f, -26f),
                new Vector2(Width - Pad * 2f - 4f - ShareWidth, 20f));

            //The switch and the label for it sit in the same place, because only one of them
            //is ever wanted: the leader decides, everyone else is told.
            shareButton = ModernUiTheme.CreateButton(root, "Share", "",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)shareButton.transform, new Vector2(1, 1),
                new Vector2(-Pad, -Pad), new Vector2(ShareWidth, ButtonRowHeight));
            shareButton.onClick.AddListener(ToggleShare);

            shareNote = ModernUiTheme.CreateText(root, "ShareNote", "", ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Right);
            ModernUiTheme.Place(shareNote.rectTransform, new Vector2(1, 1),
                new Vector2(-Pad - 2f, -Pad - 4f), new Vector2(ShareWidth, ButtonRowHeight));

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
        /// Asks for the roster the moment the tab comes up, so it never opens showing what
        /// was true the last time somebody looked at it.
        /// </summary>
        private void OnEnable()
        {
            refreshTimer = 0f;
            drawnSignature = null;
        }

        private void Update()
        {
            refreshTimer -= Time.deltaTime;
            if (refreshTimer <= 0f)
            {
                refreshTimer = RefreshInterval;

                //Only worth asking while there is a party to ask about. Out of one, the answer
                //is a refusal the server logs, every four seconds, for nothing.
                var network = NetworkManager.Instance;
                if (network != null && PlayerState.Instance.IsInParty)
                    network.PartyRequestInfo();
            }

            var signature = Signature();
            if (signature == drawnSignature)
                return;

            drawnSignature = signature;
            Redraw();
        }

        /// <summary>
        /// Everything the page draws, in one string.
        ///
        /// There is no revision counter on the party the way there is on the guild, and the
        /// roster arrives through half a dozen different packets. Rather than have each of
        /// them remember to poke this window, what is on screen is compared against what
        /// would be on screen — so anything that changes a drawn value redraws, and a refresh
        /// that changed nothing does not throw the rows away while somebody is scrolling.
        /// </summary>
        private static string Signature()
        {
            var s = PlayerState.Instance;
            if (!s.IsInParty)
                return "none";

            var sb = new StringBuilder();
            sb.Append(s.PartyName).Append('|').Append(s.PartyShareExp ? '1' : '0')
                .Append('|').Append(s.PartyLeader).Append('|').Append(s.PartyMemberId);

            foreach (var (id, m) in s.PartyMembers)
            {
                sb.Append('|').Append(id).Append(',').Append(m.PlayerName).Append(',')
                    .Append(m.Job).Append(',').Append(m.Level).Append(',')
                    .Append(m.Kills).Append(',').Append(m.EntityId > 0 ? '1' : '0');
            }

            return sb.ToString();
        }

        private static bool IsLeader()
        {
            var s = PlayerState.Instance;
            return s.IsInParty && s.PartyLeader == s.PartyMemberId;
        }

        private void ToggleShare()
        {
            var network = NetworkManager.Instance;
            if (network == null || !IsLeader())
                return;

            //Asked for as the opposite of what the server last said, not of a local flag this
            //window keeps: the switch only moves when the answer comes back.
            network.PartySetExpShare(!PlayerState.Instance.PartyShareExp);
        }

        private void Redraw()
        {
            ClearRows();

            var s = PlayerState.Instance;

            if (!s.IsInParty)
            {
                title.text = "ยังไม่ได้อยู่ในปาร์ตี้";
                subtitle.text = "สร้างปาร์ตี้ด้วย  /organize <ชื่อปาร์ตี้>  แล้วชวนด้วย  /invite <ชื่อผู้เล่น>";
                shareButton.gameObject.SetActive(false);
                shareNote.gameObject.SetActive(false);

                BuildNote("อยู่ปาร์ตี้เดียวกันจะแบ่ง Exp กัน และเห็นกันบนมินิแมพเป็นสีเขียว", -RowGap);
                BuildNote("ถ้ามีคนชวน พิมพ์  /accept  เพื่อเข้าร่วม", -RowGap - HeadingHeight);
                body.sizeDelta = new Vector2(0, RowHeight * 3f);
                return;
            }

            title.text = string.IsNullOrWhiteSpace(s.PartyName) ? "ปาร์ตี้" : s.PartyName;

            var online = 0;
            var totalKills = 0;
            foreach (var (_, m) in s.PartyMembers)
            {
                if (m.EntityId > 0)
                    online++;
                totalKills += m.Kills;
            }

            subtitle.text = $"สมาชิก {s.PartyMembers.Count} คน  ·  ออนไลน์ {online}  ·  ล้มมอนรวม {totalKills}";

            DrawShareControl();

            var y = -RowGap;

            BuildHeading("สมาชิก           อาชีพ / เลเวล                    ล้มมอนสเตอร์", y);
            y -= HeadingHeight;

            //Sorted so the list does not shuffle between refreshes: online first, then by
            //name, which is the order the panel beside the screen already uses.
            var members = new List<PartyMemberInfo>(s.PartyMembers.Values);
            members.Sort();

            foreach (var member in members)
            {
                BuildRow(member, y);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        /// <summary>
        /// The experience switch, which is a button for the leader and a statement for
        /// everybody else. The server refuses the change from anyone but the leader anyway;
        /// this is so it is not offered to somebody who cannot make it.
        /// </summary>
        private void DrawShareControl()
        {
            var shared = PlayerState.Instance.PartyShareExp;
            var leader = IsLeader();

            shareButton.gameObject.SetActive(leader);
            shareNote.gameObject.SetActive(!leader);

            if (leader)
            {
                var label = shareButton.GetComponentInChildren<TextMeshProUGUI>();
                if (label != null)
                    label.text = shared ? "Exp: แบ่งเท่ากัน" : "Exp: ต่างคนต่างเก็บ";

                var image = shareButton.GetComponent<Image>();
                if (image != null)
                    image.color = shared ? ModernUiTheme.AccentColor : ModernUiTheme.CardDeepColor;

                if (label != null)
                    label.color = shared ? ModernUiTheme.LightInkColor : ModernUiTheme.NameColor;

                return;
            }

            shareNote.text = shared ? "Exp: แบ่งเท่ากัน" : "Exp: ต่างคนต่างเก็บ";
        }

        private void BuildRow(PartyMemberInfo member, float y)
        {
            var s = PlayerState.Instance;
            var isMe = member.PartyMemberId == s.PartyMemberId;
            var isLeader = member.PartyMemberId == s.PartyLeader;
            var isOnline = member.EntityId > 0;

            //Your own row is tinted, because in a party of five reading down a column of
            //names to find yourself is the one thing you do most often here.
            var row = NewRow(y, isMe ? MeCardColor : ModernUiTheme.WindowColor);

            var dot = ModernUiTheme.CreateCard(row, "Dot", isOnline ? OnlineColor : OfflineColor);
            ModernUiTheme.Place(dot, new Vector2(0, 0.5f),
                new Vector2(9f, 0f), new Vector2(DotSize, DotSize));

            var name = ModernUiTheme.CreateText(row, "Name",
                isLeader ? $"{member.PlayerName}  (หัวปาร์ตี้)" : member.PlayerName,
                ModernUiTheme.SizeLabel, isLeader ? LeaderColor : ModernUiTheme.NameColor,
                TextAlignmentOptions.Left, isLeader ? FontStyles.Bold : FontStyles.Normal);
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(NameLeft, 0f), new Vector2(NameWidth, RowHeight));

            //A member who is offline is a name and nothing else — the server has no job or
            //level for them — and showing that as a level zero novice would be a lie rather
            //than a gap.
            var detail = member.HasDetails
                ? $"{JobName(member.Job)}   Lv.{member.Level}"
                : "ออฟไลน์";

            var info = ModernUiTheme.CreateText(row, "Detail", detail,
                ModernUiTheme.SizeLabel, isOnline ? ModernUiTheme.LabelColor : ModernUiTheme.MutedColor,
                TextAlignmentOptions.Left);
            ModernUiTheme.Place(info.rectTransform, new Vector2(0, 0.5f),
                new Vector2(DetailLeft, 0f), new Vector2(DetailWidth, RowHeight));

            var kills = ModernUiTheme.CreateText(row, "Kills", member.Kills.ToString(),
                ModernUiTheme.SizeLabel,
                member.Kills > 0 ? ModernUiTheme.NameColor : ModernUiTheme.MutedColor,
                TextAlignmentOptions.Right, member.Kills > 0 ? FontStyles.Bold : FontStyles.Normal);
            ModernUiTheme.Place(kills.rectTransform, new Vector2(1, 0.5f),
                new Vector2(-12f, 0f), new Vector2(KillsWidth, RowHeight));
        }

        private RectTransform NewRow(float y, Color color)
        {
            var row = ModernUiTheme.CreateCard(body, "Row", color);
            row.anchorMin = new Vector2(0, 1);
            row.anchorMax = new Vector2(1, 1);
            row.pivot = new Vector2(0.5f, 1);
            row.sizeDelta = new Vector2(-RowGap * 2f, RowHeight);
            row.anchoredPosition = new Vector2(0, y);
            row.GetComponent<Image>().raycastTarget = false;
            rows.Add(row.gameObject);
            return row;
        }

        private void BuildHeading(string text, float y)
        {
            var label = ModernUiTheme.CreateText(body, "Heading", text,
                ModernUiTheme.SizeSmall, ModernUiTheme.LabelColor, TextAlignmentOptions.Left,
                FontStyles.Bold);
            var rect = label.rectTransform;
            rect.anchorMin = new Vector2(0, 1);
            rect.anchorMax = new Vector2(1, 1);
            rect.pivot = new Vector2(0.5f, 1);
            rect.sizeDelta = new Vector2(-30f, HeadingHeight);
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
