using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// The people standing near you, and what you can do about them.
    ///
    /// On a desktop you point at somebody and right click. A phone has neither: every
    /// action the touch controls offer picks its own target, always the nearest one, which
    /// is right for swinging a sword and wrong for anything aimed at a particular person -
    /// "invite whoever happens to be closest" is how you end up in a party with a stranger.
    ///
    /// So the choosing is done from a list instead. A row is a big target that does not
    /// move, it says who it belongs to before you commit to it, and two characters standing
    /// on the same tile are still two rows. It reads off the entities the client already
    /// tracks, so there is nothing to ask the server for.
    ///
    /// Laid out by hand for the same reason the party page is: the list is of unknown
    /// length, and a layout group with a size fitter leaves the rect it drives at zero
    /// height until a layout pass has run on an active object.
    /// </summary>
    public class NearbyPeopleWindow : WindowBase
    {
        private const float Width = 460f;
        private const float Height = 440f;
        private const float Pad = 8f;

        private const float RowHeight = 30f;
        private const float RowGap = 3f;
        private const float HeadingHeight = 22f;

        //One set of columns, used by the rows and by the titles above them. A row is 438
        //wide inside the window's padding, and every column below has to add up to less
        //than that or the last one is drawn off the edge of a phone screen.
        private const float NameLeft = 8f;
        private const float NameWidth = 128f;
        private const float DetailLeft = 140f;
        private const float DetailWidth = 96f;
        private const float RangeLeft = 240f;
        private const float RangeWidth = 26f;
        private const float TradeLeft = 272f;
        private const float TradeWidth = 76f;
        private const float ActionLeft = 352f;
        private const float ActionWidth = 80f;

        /// <summary>
        /// How far away somebody can be and still be worth listing, in tiles.
        ///
        /// About a screen's worth. Further than that and they are not somebody you are
        /// standing with, they are somebody the client happens to still be drawing.
        /// </summary>
        private const int Range = 25;

        /// <summary>
        /// How close you have to be to trade, which is the server's own limit rather than
        /// this list's. Anyone further off is listed but has no trade button, so a button is
        /// never offered that could only produce a refusal.
        /// </summary>
        private const int TradeRange = 12;

        /// <summary>Rebuilt on a timer because people walk; anything faster is wasted work.</summary>
        private const float RefreshInterval = 1f;

        private static NearbyPeopleWindow instance;

        private RectTransform body;
        private TextMeshProUGUI subtitle;

        private readonly List<GameObject> rows = new List<GameObject>();
        private readonly List<ServerControllable> found = new List<ServerControllable>();

        private float refreshTimer;

        /// <summary>Opens the list, building it the first time it is asked for.</summary>
        public static void Open()
        {
            if (instance == null)
                instance = Build();

            if (instance == null)
                return;

            instance.gameObject.SetActive(true);
            instance.refreshTimer = 0f;
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

        private static NearbyPeopleWindow Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            //assembled inactive so nothing runs against a half built window
            var host = new GameObject("NearbyPeopleWindow", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<NearbyPeopleWindow>();
            window.CanCloseWithEscape = true;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, ThaiUiText.Get("Nearby"), "", ModernUiIcons.Person);
            ModernUiTheme.AttachShadow(rect);

            window.subtitle = ModernUiTheme.CreateText(rect, "Count", "", ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Right);
            window.subtitle.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(window.subtitle.rectTransform, new Vector2(1, 1),
                new Vector2(-52f, -30f), new Vector2(200f, 20f));

            //A sunken tray, which is also what catches the drag that scrolls it: the gaps
            //between the rows would otherwise pass the pointer straight through.
            var viewport = ModernUiTheme.CreateCard(rect, "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Stretch(viewport, Pad, Pad, -Pad, -(ModernUiTheme.TitleBarHeight));
            viewport.gameObject.AddComponent<RectMask2D>();

            window.body = ModernUiTheme.CreateRect("People", viewport);
            window.body.anchorMin = new Vector2(0, 1);
            window.body.anchorMax = new Vector2(1, 1);
            window.body.pivot = new Vector2(0.5f, 1);
            window.body.offsetMin = Vector2.zero;
            window.body.offsetMax = Vector2.zero;

            var scroll = host.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = window.body;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 32f;

            host.SetActive(true);
            return window;
        }

        private void Update()
        {
            refreshTimer -= Time.deltaTime;
            if (refreshTimer > 0f)
                return;
            refreshTimer = RefreshInterval;

            Redraw();
        }

        /// <summary>
        /// Everyone the client is drawing who is a player, is not you, and is close enough
        /// to be somebody you are standing with. Sorted by distance, so the list does not
        /// reshuffle while it is being read - the nearest name stays the top row.
        /// </summary>
        private void Gather()
        {
            found.Clear();

            var network = NetworkManager.Instance;
            if (network == null || network.EntityList == null)
                return;

            var me = CameraFollower.Instance != null ? CameraFollower.Instance.PlayerPosition : Vector2Int.zero;
            if (me == Vector2Int.zero)
                return;

            foreach (var entity in network.EntityList.Values)
            {
                if (entity == null || entity.IsMainCharacter || entity.IsHidden)
                    continue;

                //PlayerLikeNpc looks like a player and is not one; inviting a shop dummy to
                //a party is a request the server can only refuse
                if (entity.CharacterType != CharacterType.Player)
                    continue;

                if (Distance(me, entity) > Range)
                    continue;

                found.Add(entity);
            }

            found.Sort((a, b) => Distance(me, a).CompareTo(Distance(me, b)));
        }

        private static int Distance(Vector2Int from, ServerControllable to)
        {
            var d = to.CellPosition - from;
            return Mathf.RoundToInt(Mathf.Sqrt(d.x * d.x + d.y * d.y));
        }

        private void Redraw()
        {
            ClearRows();
            Gather();

            var me = CameraFollower.Instance != null ? CameraFollower.Instance.PlayerPosition : Vector2Int.zero;
            subtitle.text = found.Count > 0 ? $"{found.Count} คนในระยะ {Range} ช่อง" : "";

            var y = -RowGap;

            if (found.Count == 0)
            {
                BuildNote("ไม่มีใครอยู่ใกล้ ๆ ตอนนี้", y);
                BuildNote($"รายชื่อจะขึ้นเมื่อมีผู้เล่นเข้ามาในระยะ {Range} ช่อง", y - HeadingHeight);
                body.sizeDelta = new Vector2(0, RowHeight * 3f);
                return;
            }

            //Said once, above the list, rather than repeated down a narrow column.
            //Whether you may invite anybody at all is a fact about you, not about them, so
            //writing it on every row would be the same sentence eight times, in a space too
            //narrow to hold it, in place of the one thing the column is for.
            var blocker = PartyBlocker();
            if (blocker != null)
            {
                BuildNote(blocker, y);
                y -= HeadingHeight + RowGap;
            }

            BuildHeading(y);
            y -= HeadingHeight;

            foreach (var person in found)
            {
                BuildRow(person, me, blocker != null, y);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        /// <summary>
        /// Why none of these rows can be acted on, or null when they can.
        ///
        /// Both cases are about the reader rather than about anybody in the list: you are in
        /// a party and are not the one who may invite, or you are in none and cannot start
        /// one yet. The server checks both again; this is so a button is never offered that
        /// could only produce a refusal.
        /// </summary>
        private static string PartyBlocker()
        {
            var state = PlayerState.Instance;

            if (state.IsInParty)
                return state.PartyLeader == state.PartyMemberId ? null : "หัวปาร์ตี้เท่านั้นที่ชวนคนเข้าตี้ได้";

            if (!state.KnownSkills.TryGetValue(CharacterSkill.BasicMastery, out var mastery) || mastery < 6)
                return "ต้องมี Basic Skill เลเวล 6 ขึ้นไป ถึงจะตั้งปาร์ตี้ได้";

            return null;
        }

        private void BuildRow(ServerControllable person, Vector2Int me, bool blocked, float y)
        {
            var row = NewRow(y);

            var name = ModernUiTheme.CreateText(row, "Name", person.Name,
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.Left,
                FontStyles.Bold);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(NameLeft, 0f), new Vector2(NameWidth, RowHeight));

            var detail = ModernUiTheme.CreateText(row, "Detail",
                $"{JobName(person.ClassId)}  Lv.{person.Level}",
                ModernUiTheme.SizeSmall, ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            detail.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(detail.rectTransform, new Vector2(0, 0.5f),
                new Vector2(DetailLeft, 0f), new Vector2(DetailWidth, RowHeight));

            var range = ModernUiTheme.CreateText(row, "Range", Distance(me, person).ToString(),
                ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor, TextAlignmentOptions.Right);
            ModernUiTheme.Place(range.rectTransform, new Vector2(0, 0.5f),
                new Vector2(RangeLeft, 0f), new Vector2(RangeWidth, RowHeight));

            BuildTradeAction(row, person, Distance(me, person));
            BuildPartyAction(row, person, blocked);
        }

        /// <summary>
        /// The button that asks somebody to trade, when they are close enough to.
        ///
        /// On a desktop this is the right click menu; a phone has neither a second mouse
        /// button nor a way to point at one character among several standing on the same
        /// tile, so the row is the target instead.
        /// </summary>
        private void BuildTradeAction(RectTransform row, ServerControllable person, int distance)
        {
            if (distance > TradeRange)
            {
                var far = ModernUiTheme.CreateText(row, "TooFar", "ไกลไป", ModernUiTheme.SizeSmall,
                    ModernUiTheme.MutedColor, TextAlignmentOptions.Center);
                far.textWrappingMode = TextWrappingModes.NoWrap;
                ModernUiTheme.Place(far.rectTransform, new Vector2(0, 0.5f),
                    new Vector2(TradeLeft, 0f), new Vector2(TradeWidth, RowHeight));
                return;
            }

            //captured now, because the row is thrown away and rebuilt on the next refresh
            var id = person.Id;

            var button = ModernUiTheme.CreateButton(row, "Trade", "ขอเดล",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 0.5f),
                new Vector2(TradeLeft, 0f), new Vector2(TradeWidth, RowHeight - 6f));
            button.onClick.AddListener(() =>
                NetworkManager.Instance.SendTradeAction(TradeAction.Request, id));
        }

        /// <summary>
        /// The one thing this row can do, or why it cannot.
        ///
        /// The same three cases the desktop's right click menu works through, decided the
        /// same way: only a leader may invite, only somebody with no party may be invited,
        /// and forming one needs Basic Mastery 6. The server checks all of it again - this
        /// is so a button is never offered that could only produce a refusal.
        /// </summary>
        /// <summary>
        /// The one thing this row can do, or why it cannot.
        ///
        /// Only what is true of this person in particular: whether they already have a
        /// party. Anything true of the reader was answered once above the list.
        /// </summary>
        private void BuildPartyAction(RectTransform row, ServerControllable person, bool blocked)
        {
            var state = PlayerState.Instance;

            if (!string.IsNullOrWhiteSpace(person.PartyName))
            {
                var sameParty = state.IsInParty && person.PartyName == state.PartyName;
                Reason(row, sameParty ? "อยู่ตี้เรา" : "มีตี้แล้ว");
                return;
            }

            if (blocked)
            {
                Reason(row, "—");
                return;
            }

            //captured now, because the row is thrown away and rebuilt on the next refresh
            var id = person.Id;
            var who = person.Name;

            //Offered on every row whatever else is, because a phone has no right mouse
            //button and this list is the only place a touch screen can reach a name.
            if (!state.IsFriend(who))
                Action(row, "จดจำ", () => NetworkManager.Instance.SendFriendAdd(who));
            else
                Action(row, "คุย", () => Party.WhisperWindow.Open(who));

            if (state.IsInParty)
            {
                Action(row, "ชวนเข้าตี้", () =>
                {
                    NetworkManager.Instance.PartyInviteById(id);
                    CameraFollower.Instance.AppendChatText($"<color={ChatColor.Party}>ส่งคำชวนไปที่ {who} แล้ว</color>");
                });
                return;
            }

            //no party of your own yet, so the offer is to start one with them in it
            Action(row, "ตั้งปาร์ตี้", () =>
                UiManager.Instance.TextInputWindow.BeginTextInput("ตั้งชื่อปาร์ตี้ (ห้ามซ้ำกับคนอื่น)",
                    partyName => NetworkManager.Instance.OrganizeParty(partyName, id),
                    "ตั้งปาร์ตี้", ModernUiIcons.Person));
        }

        private static void Action(RectTransform row, string label, UnityEngine.Events.UnityAction onClick)
        {
            var button = ModernUiTheme.CreateButton(row, "Action", label,
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 0.5f),
                new Vector2(ActionLeft, 0f), new Vector2(ActionWidth, RowHeight - 6f));
            button.onClick.AddListener(onClick);
        }

        private static void Reason(RectTransform row, string text)
        {
            var label = ModernUiTheme.CreateText(row, "Reason", text, ModernUiTheme.SizeSmall,
                ModernUiTheme.MutedColor, TextAlignmentOptions.Center);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(label.rectTransform, new Vector2(0, 0.5f),
                new Vector2(ActionLeft, 0f), new Vector2(ActionWidth, RowHeight));
        }

        /// <summary>
        /// The column titles, laid on a strip the same shape and inset as a row and placed
        /// at the same offsets its columns use, so the two cannot drift apart.
        /// </summary>
        private void BuildHeading(float y)
        {
            var strip = ModernUiTheme.CreateRect("Heading", body);
            strip.anchorMin = new Vector2(0, 1);
            strip.anchorMax = new Vector2(1, 1);
            strip.pivot = new Vector2(0.5f, 1);
            strip.sizeDelta = new Vector2(-RowGap * 2f, HeadingHeight);
            strip.anchoredPosition = new Vector2(0, y);
            rows.Add(strip.gameObject);

            Title(strip, "ชื่อ", NameLeft, NameWidth, TextAlignmentOptions.Left);
            Title(strip, "อาชีพ / เลเวล", DetailLeft, DetailWidth, TextAlignmentOptions.Left);
            Title(strip, "ช่อง", RangeLeft, RangeWidth, TextAlignmentOptions.Right);
            Title(strip, "แลกของ", TradeLeft, TradeWidth, TextAlignmentOptions.Center);
            Title(strip, "ปาร์ตี้", ActionLeft, ActionWidth, TextAlignmentOptions.Center);
        }

        private static void Title(RectTransform strip, string text, float x, float width,
            TextAlignmentOptions align)
        {
            var label = ModernUiTheme.CreateText(strip, "Title", text, ModernUiTheme.SizeSmall,
                ModernUiTheme.LabelColor, align, FontStyles.Bold);
            //a title that does not fit runs on rather than folding onto a second line the
            //strip has no room for and would clip in half
            label.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(label.rectTransform, new Vector2(0, 0.5f),
                new Vector2(x, 0f), new Vector2(width, HeadingHeight));
        }

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
