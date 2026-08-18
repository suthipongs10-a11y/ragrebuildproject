using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Trading
{
    /// <summary>One thing on the table, and the bag slot it came out of.</summary>
    public struct OfferedItem
    {
        public int BagId;
        public InventoryItem Item;
    }

    /// <summary>
    /// The table two players put things on.
    ///
    /// Two columns, yours and theirs, and two buttons rather than one. Agreeing (ตกลง) says
    /// yes to what is on the table now; confirming (ยืนยัน) is the one that moves anything,
    /// and is only reachable once both have agreed. Anything either side changes takes both
    /// agreements off again - which is the whole reason there are two steps, because with
    /// one, the other player can swap what they were offering after you have said yes.
    ///
    /// Both columns are drawn from what the server sent, never from what this client thinks
    /// it put down. A trade is the one place where showing something that is not what is
    /// actually being offered is the entire problem.
    ///
    /// Built in code rather than from a prefab so it exists on a phone build without anyone
    /// having to open Unity and wire it up, and laid out by hand because both lists are of
    /// unknown length and a size fitter leaves the rect it drives at zero height until a
    /// layout pass has run on an active object.
    /// </summary>
    public class TradeWindow : WindowBase
    {
        private const float Width = 470f;
        private const float Height = 470f;
        private const float Pad = 8f;

        //two columns of equal width, with the same gap between them as around them
        private const float ColumnWidth = (Width - Pad * 3f) / 2f;
        private const float LeftColumn = Pad;
        private const float RightColumn = Pad * 2f + ColumnWidth;

        private const float HeaderHeight = 20f;
        private const float ListHeight = 208f;
        private const float RowHeight = 30f;
        private const float RowGap = 2f;
        private const float IconSize = 24f;

        private const float ButtonHeight = 30f;

        /// <summary>Matches the server's own cap, so a full bag cannot be put down at once.</summary>
        private const int MaxOfferedItems = 10;

        private static TradeWindow instance;

        private string partnerName = "";

        private readonly List<OfferedItem> myOffer = new List<OfferedItem>();
        private readonly List<OfferedItem> theirOffer = new List<OfferedItem>();
        private int myZeny;
        private int theirZeny;

        private bool myLock;
        private bool theirLock;
        private bool myConfirm;
        private bool theirConfirm;

        /// <summary>
        /// Whether the left column is showing the bag instead of the offer.
        ///
        /// A phone has nothing to drag an item with and no second mouse button, so putting
        /// something down is picking it off a list. The same list works with a mouse, so
        /// there is one way of doing it rather than one per screen.
        /// </summary>
        private bool picking;

        private RectTransform mineBody;
        private RectTransform theirsBody;
        private TextMeshProUGUI mineHeader;
        private TextMeshProUGUI theirsHeader;
        private TextMeshProUGUI mineZenyLabel;
        private TextMeshProUGUI theirsZenyLabel;
        private TextMeshProUGUI status;

        private Button addItemButton;
        private Button addZenyButton;
        private Button lockButton;
        private Button confirmButton;

        private readonly List<GameObject> mineRows = new List<GameObject>();
        private readonly List<GameObject> theirsRows = new List<GameObject>();

        public static bool IsOpen => instance != null && instance.gameObject.activeSelf;

        /// <summary>Both sides are at the table. Opens onto an empty one.</summary>
        public static void Begin(string partner)
        {
            if (instance == null)
                instance = Build();
            if (instance == null)
                return;

            instance.partnerName = partner;
            instance.myOffer.Clear();
            instance.theirOffer.Clear();
            instance.myZeny = 0;
            instance.theirZeny = 0;
            instance.myLock = false;
            instance.theirLock = false;
            instance.myConfirm = false;
            instance.theirConfirm = false;
            instance.picking = false;

            instance.gameObject.SetActive(true);
            instance.MoveToTop();
            instance.Redraw();
        }

        /// <summary>
        /// One side's offer, in full.
        ///
        /// Replaced rather than merged: the packet is the whole truth about that column, and
        /// keeping a row because no removal happened to arrive is how a window ends up
        /// showing an item that is no longer being offered.
        /// </summary>
        public static void SetOffer(bool mine, int zeny, List<OfferedItem> items)
        {
            if (instance == null)
                return;

            var target = mine ? instance.myOffer : instance.theirOffer;
            target.Clear();
            target.AddRange(items);

            if (mine)
                instance.myZeny = zeny;
            else
                instance.theirZeny = zeny;

            //an offer that changed is an offer nobody has agreed to yet; the server says so
            //too, in its own packet, but the window should not show a stale tick in between
            instance.myLock = false;
            instance.theirLock = false;
            instance.myConfirm = false;
            instance.theirConfirm = false;

            instance.Redraw();
        }

        public static void SetLocks(bool mine, bool theirs, bool mineConfirmed, bool theirsConfirmed)
        {
            if (instance == null)
                return;

            instance.myLock = mine;
            instance.theirLock = theirs;
            instance.myConfirm = mineConfirmed;
            instance.theirConfirm = theirsConfirmed;
            instance.Redraw();
        }

        /// <summary>Over, one way or the other. Says which in chat and gets out of the way.</summary>
        public static void Finish(string message, bool success)
        {
            if (!string.IsNullOrWhiteSpace(message))
                CameraFollower.Instance.AppendChatText(success
                    ? $"<color=#77FF77>{message}</color>"
                    : $"<color=#ed0000>{message}</color>");

            //HideWindow rather than CloseWindow: this is the server telling us the trade is
            //already over, and closing sends a cancel, which would be answering a trade that
            //no longer exists
            if (instance != null)
                instance.HideWindow();
        }

        /// <summary>
        /// Closing the window calls the trade off rather than hiding it.
        ///
        /// A trade that is still running with no window is a trade the player cannot see,
        /// cannot cancel, and which blocks every other trade they try to start.
        /// </summary>
        public override void CloseWindow()
        {
            if (gameObject.activeSelf)
                NetworkManager.Instance.SendTradeAction(TradeAction.Cancel);

            base.CloseWindow();
        }

        private static TradeWindow Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            //assembled inactive so nothing runs against a half built window
            var host = new GameObject("TradeWindow", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<TradeWindow>();
            //Escape must not close it silently: closing calls the trade off, and a key that
            //cancels a trade by accident is worse than no key at all.
            window.CanCloseWithEscape = false;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, "แลกเปลี่ยนของ", "", ModernUiIcons.Bag);
            ModernUiTheme.AttachShadow(rect);

            var top = -ModernUiTheme.TitleBarHeight;

            window.mineHeader = Header(rect, "MineHeader", "ของเรา", LeftColumn, top);
            window.theirsHeader = Header(rect, "TheirsHeader", "ของเขา", RightColumn, top);

            var listTop = top - HeaderHeight;
            window.mineBody = Column(window, rect, "Mine", LeftColumn, listTop);
            window.theirsBody = Column(window, rect, "Theirs", RightColumn, listTop);

            var zenyTop = listTop - ListHeight - 4f;
            window.mineZenyLabel = ZenyRow(rect, "MineZeny", LeftColumn, zenyTop);
            window.theirsZenyLabel = ZenyRow(rect, "TheirsZeny", RightColumn, zenyTop);

            //the two ways of putting something down, both on our own side of the table
            var addTop = zenyTop - 26f;
            var half = (ColumnWidth - 4f) / 2f;

            window.addItemButton = ModernUiTheme.CreateButton(rect, "AddItem", "＋ ใส่ของ",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)window.addItemButton.transform, new Vector2(0, 1),
                new Vector2(LeftColumn, addTop), new Vector2(half, ButtonHeight - 4f));
            window.addItemButton.onClick.AddListener(window.OnAddItem);

            window.addZenyButton = ModernUiTheme.CreateButton(rect, "AddZeny", "＋ ใส่เงิน",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)window.addZenyButton.transform, new Vector2(0, 1),
                new Vector2(LeftColumn + half + 4f, addTop), new Vector2(half, ButtonHeight - 4f));
            window.addZenyButton.onClick.AddListener(window.OnAddZeny);

            var statusTop = addTop - ButtonHeight;
            window.status = ModernUiTheme.CreateText(rect, "Status", "", ModernUiTheme.SizeSmall,
                ModernUiTheme.MutedColor, TextAlignmentOptions.Center);
            window.status.textWrappingMode = TextWrappingModes.Normal;
            ModernUiTheme.Place(window.status.rectTransform, new Vector2(0, 1),
                new Vector2(Pad, statusTop), new Vector2(Width - Pad * 2f, 34f));

            //the three answers, in the order they are reached
            var buttonTop = statusTop - 36f;
            var third = (Width - Pad * 2f - 8f) / 3f;

            window.lockButton = ModernUiTheme.CreateButton(rect, "Lock", "ตกลง",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)window.lockButton.transform, new Vector2(0, 1),
                new Vector2(Pad, buttonTop), new Vector2(third, ButtonHeight));
            window.lockButton.onClick.AddListener(() =>
                NetworkManager.Instance.SendTradeAction(TradeAction.Lock));

            window.confirmButton = ModernUiTheme.CreateButton(rect, "Confirm", "ยืนยัน",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)window.confirmButton.transform, new Vector2(0, 1),
                new Vector2(Pad + third + 4f, buttonTop), new Vector2(third, ButtonHeight));
            window.confirmButton.onClick.AddListener(() =>
                NetworkManager.Instance.SendTradeAction(TradeAction.Confirm));

            var cancel = ModernUiTheme.CreateButton(rect, "Cancel", "ยกเลิก",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)cancel.transform, new Vector2(0, 1),
                new Vector2(Pad + (third + 4f) * 2f, buttonTop), new Vector2(third, ButtonHeight));
            cancel.onClick.AddListener(window.CloseWindow);

            host.SetActive(true);
            return window;
        }

        private static TextMeshProUGUI Header(RectTransform parent, string name, string text,
            float x, float y)
        {
            var label = ModernUiTheme.CreateText(parent, name, text, ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left, FontStyles.Bold);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            //a name that does not fit is cut off rather than folded onto a line the header
            //strip has no room for, which would clip it in half
            label.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(label.rectTransform, new Vector2(0, 1), new Vector2(x, y),
                new Vector2(ColumnWidth, HeaderHeight));
            return label;
        }

        /// <summary>A sunken tray that scrolls, and the rect the rows go into.</summary>
        private static RectTransform Column(TradeWindow window, RectTransform parent, string name,
            float x, float y)
        {
            var viewport = ModernUiTheme.CreateCard(parent, name + "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Place(viewport, new Vector2(0, 1), new Vector2(x, y),
                new Vector2(ColumnWidth, ListHeight));
            viewport.gameObject.AddComponent<RectMask2D>();

            var body = ModernUiTheme.CreateRect(name, viewport);
            body.anchorMin = new Vector2(0, 1);
            body.anchorMax = new Vector2(1, 1);
            body.pivot = new Vector2(0.5f, 1);
            body.offsetMin = Vector2.zero;
            body.offsetMax = Vector2.zero;

            var scroll = viewport.gameObject.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = body;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 32f;

            return body;
        }

        private static TextMeshProUGUI ZenyRow(RectTransform parent, string name, float x, float y)
        {
            var label = ModernUiTheme.CreateText(parent, name, "0 z", ModernUiTheme.SizeLabel,
                ModernUiTheme.NameColor, TextAlignmentOptions.Right, FontStyles.Bold);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(label.rectTransform, new Vector2(0, 1), new Vector2(x, y),
                new Vector2(ColumnWidth, 22f));
            return label;
        }

        // --- putting something down ------------------------------------------------

        private void OnAddItem()
        {
            if (myOffer.Count >= MaxOfferedItems && !picking)
            {
                CameraFollower.Instance.AppendError($"วางของได้ครั้งละ {MaxOfferedItems} ชนิดเท่านั้น");
                return;
            }

            picking = !picking;
            Redraw();
        }

        private void OnAddZeny()
        {
            UiManager.Instance.TextInputWindow.BeginTextInput(
                $"ใส่เงินเท่าไหร่ (มีอยู่ {PlayerState.Instance.Zeny:N0} z)", text =>
                {
                    //the server checks the amount again; this is so a typo produces a message
                    //rather than a packet the server has to refuse
                    if (!int.TryParse(text, out var amount) || amount < 0)
                    {
                        CameraFollower.Instance.AppendError("ใส่เป็นตัวเลขเท่านั้น");
                        return;
                    }

                    NetworkManager.Instance.SendTradeAction(TradeAction.SetZeny, amount);
                });
        }

        /// <summary>
        /// Puts one bag slot on the table, asking how many out of it when there is a choice.
        /// </summary>
        private void Offer(int bagId, int available)
        {
            picking = false;

            if (available <= 1)
            {
                NetworkManager.Instance.SendTradeAddItem(bagId, 1);
                Redraw();
                return;
            }

            UiManager.Instance.TextInputWindow.BeginTextInput($"ใส่กี่ชิ้น (มี {available})", text =>
            {
                if (!int.TryParse(text, out var count) || count <= 0)
                {
                    CameraFollower.Instance.AppendError("ใส่เป็นตัวเลขเท่านั้น");
                    return;
                }

                if (count > available)
                    count = available;

                NetworkManager.Instance.SendTradeAddItem(bagId, count);
            });

            Redraw();
        }

        // --- drawing ---------------------------------------------------------------

        private void Redraw()
        {
            //Decided before anything is drawn rather than after: what is on the table cannot
            //change once we have agreed to it, and a header still reading "pick something"
            //over a list that is no longer the bag is worse than either state on its own.
            if (myLock)
                picking = false;

            mineHeader.text = picking ? "เลือกของจากกระเป๋า" : "ของเรา";
            theirsHeader.text = string.IsNullOrWhiteSpace(partnerName) ? "ของเขา" : $"ของ {partnerName}";

            mineZenyLabel.text = $"{myZeny:N0} z";
            theirsZenyLabel.text = $"{theirZeny:N0} z";

            var addLabel = addItemButton.GetComponentInChildren<TextMeshProUGUI>();
            if (addLabel != null)
                addLabel.text = picking ? "ย้อนกลับ" : "＋ ใส่ของ";

            if (picking)
                DrawBag();
            else
                DrawOffer(mineBody, mineRows, myOffer, true);

            DrawOffer(theirsBody, theirsRows, theirOffer, false);

            DrawStatus();
        }

        private void DrawOffer(RectTransform body, List<GameObject> rows, List<OfferedItem> items,
            bool mine)
        {
            Clear(rows);

            var y = -RowGap;
            foreach (var entry in items)
            {
                BuildItemRow(body, rows, y, entry.Item, entry.Item.Count,
                    //tapping our own row takes it back off the table; tapping theirs is the
                    //only way to read what it actually is
                    mine
                        ? (System.Action)(() => NetworkManager.Instance.SendTradeAction(
                            TradeAction.RemoveItem, entry.BagId))
                        : () => UiManager.Instance.ItemDescriptionWindow.ShowItemDescription(entry.Item));
                y -= RowHeight + RowGap;
            }

            if (items.Count == 0)
                Note(body, rows, mine ? "ยังไม่ได้วางอะไร" : "เขายังไม่ได้วางอะไร", -RowGap);

            body.sizeDelta = new Vector2(0, Mathf.Max(ListHeight, -y));
        }

        /// <summary>
        /// The bag, as something to pick from.
        ///
        /// Anything already on the table is left out rather than shown greyed: putting the
        /// same slot down twice would replace the count rather than add to it, which reads
        /// as the second tap having done nothing.
        /// </summary>
        private void DrawBag()
        {
            Clear(mineRows);

            var y = -RowGap;
            var bag = PlayerState.Instance.Inventory;
            var shown = 0;

            if (bag != null)
            {
                foreach (var (bagId, item) in bag.GetInventoryData())
                {
                    if (IsOffered(bagId))
                        continue;

                    var slot = bagId;
                    var count = item.Count;
                    BuildItemRow(mineBody, mineRows, y, item, count, () => Offer(slot, count));
                    y -= RowHeight + RowGap;
                    shown++;
                }
            }

            if (shown == 0)
                Note(mineBody, mineRows, "ไม่มีของให้วาง", -RowGap);

            mineBody.sizeDelta = new Vector2(0, Mathf.Max(ListHeight, -y));
        }

        private bool IsOffered(int bagId)
        {
            foreach (var entry in myOffer)
            {
                if (entry.BagId == bagId)
                    return true;
            }

            return false;
        }

        private static void BuildItemRow(RectTransform body, List<GameObject> rows, float y,
            InventoryItem item, int count, System.Action onClick)
        {
            var row = ModernUiTheme.CreateCard(body, "Row", ModernUiTheme.WindowColor);
            row.anchorMin = new Vector2(0, 1);
            row.anchorMax = new Vector2(1, 1);
            row.pivot = new Vector2(0.5f, 1);
            row.sizeDelta = new Vector2(-RowGap * 2f, RowHeight);
            row.anchoredPosition = new Vector2(0, y);
            rows.Add(row.gameObject);

            var button = row.gameObject.AddComponent<Button>();
            button.targetGraphic = row.GetComponent<Image>();
            row.GetComponent<Image>().raycastTarget = true;
            button.onClick.AddListener(() => onClick());

            var icon = ModernUiTheme.CreateIcon(row, null, Color.white, IconSize);
            var sprite = ClientDataLoader.Instance != null && item.ItemData != null
                ? ClientDataLoader.Instance.GetIconAtlasSprite(item.ItemData.Sprite)
                : null;
            if (sprite != null)
                icon.sprite = sprite;
            else
                icon.color = new Color(0, 0, 0, 0);
            ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(4f, 0f),
                new Vector2(IconSize, IconSize));

            var name = ModernUiTheme.CreateText(row, "Name",
                count > 1 ? $"{item.ProperName()} x{count}" : item.ProperName(),
                ModernUiTheme.SizeSmall, ModernUiTheme.NameColor, TextAlignmentOptions.Left);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(IconSize + 8f, 0f), new Vector2(ColumnWidth - IconSize - 16f, RowHeight));
        }

        private static void Note(RectTransform body, List<GameObject> rows, string text, float y)
        {
            var label = ModernUiTheme.CreateText(body, "Note", text, ModernUiTheme.SizeSmall,
                ModernUiTheme.MutedColor, TextAlignmentOptions.Center);
            label.textWrappingMode = TextWrappingModes.Normal;
            label.rectTransform.anchorMin = new Vector2(0, 1);
            label.rectTransform.anchorMax = new Vector2(1, 1);
            label.rectTransform.pivot = new Vector2(0.5f, 1);
            label.rectTransform.sizeDelta = new Vector2(-RowGap * 2f, RowHeight * 2f);
            label.rectTransform.anchoredPosition = new Vector2(0, y);
            rows.Add(label.gameObject);
        }

        /// <summary>
        /// What the player is waiting for, said in words.
        ///
        /// Which of the two buttons is live is not enough on its own: "press confirm" and
        /// "you have pressed it, they have not" leave the screen looking identical, and that
        /// is where somebody sits pressing a button that already did its job.
        /// </summary>
        private void DrawStatus()
        {
            var who = string.IsNullOrWhiteSpace(partnerName) ? "อีกฝ่าย" : partnerName;

            if (!myLock && !theirLock)
                status.text = "วางของแล้วกด ตกลง — เปลี่ยนของทีหลังได้ แต่ต้องตกลงกันใหม่";
            else if (myLock && !theirLock)
                status.text = $"เราตกลงแล้ว รอ {who} กด ตกลง";
            else if (!myLock)
                status.text = $"{who} ตกลงแล้ว รอเรากด ตกลง";
            else if (!myConfirm && !theirConfirm)
                status.text = "ตกลงกันครบแล้ว กด ยืนยัน เพื่อแลกจริง";
            else if (myConfirm && !theirConfirm)
                status.text = $"เรายืนยันแล้ว รอ {who} ยืนยัน";
            else
                status.text = $"{who} ยืนยันแล้ว รอเรากด ยืนยัน";

            //agreeing again after having agreed does nothing, and confirming before both
            //have agreed is refused by the server, so neither is offered
            lockButton.interactable = !myLock;
            confirmButton.interactable = myLock && theirLock && !myConfirm;

            //what is on the table cannot change once we have agreed to it
            addItemButton.interactable = !myLock;
            addZenyButton.interactable = !myLock;
        }

        private static void Clear(List<GameObject> rows)
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
