using System;
using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Market
{
    /// <summary>
    /// The market: what is up for auction, what you have a stake in, and what is waiting
    /// to be collected.
    ///
    /// Three pages in one window rather than three windows, because on a phone a second
    /// floating window is a window covering the one you were reading - and the three are
    /// one errand: you list something, you check on it, you collect what it earned.
    ///
    /// Nothing here decides anything. Every number on screen came off the wire and every
    /// button sends a request; the server owns the listings and the parcel box, and this
    /// draws its answers. <see cref="MarketState.Revision"/> is how it notices they
    /// changed - the number last drawn is kept and the page is rebuilt when it no longer
    /// matches, which avoids an event holding a reference to a destroyed window.
    ///
    /// Laid out by hand for the same reason the guild page is: the lists are of unknown
    /// length, and a layout group with a size fitter leaves the rect it drives at zero
    /// height until a layout pass has run on an active object.
    /// </summary>
    public class MarketWindow : WindowBase
    {
        private const float Width = 580f;
        private const float Height = 500f;
        private const float Pad = 8f;

        private const float TabHeight = 30f;
        private const float TabGap = 4f;
        private const float ToolRowHeight = 28f;
        private const float RowHeight = 38f;
        private const float RowGap = 4f;
        private const float HeadingHeight = 22f;

        /// <summary>The card at the top of one listing's own page.</summary>
        private const float DetailHeight = 70f;

        /// <summary>Where the icon sits, clear of the stripe down the left edge.</summary>
        private const float IconInset = 10f;

        /// <summary>Where the words start, clear of the icon.</summary>
        private const float TextInset = RowHeight + 4f;

        /// <summary>The button on the right of a row.</summary>
        private const float ActionWidth = 74f;

        /// <summary>The price and the countdown, right aligned against the button.</summary>
        private const float MoneyWidth = 150f;

        /// <summary>How wide the words on the left may run before they meet the money.</summary>
        private const float LabelWidth = Width - TextInset - MoneyWidth - ActionWidth - 48f;

        /// <summary>The same, on a row that has no money column - a picker.</summary>
        private const float PlainWidth = Width - TextInset - ActionWidth - 32f;

        // -----------------------------------------------------------------
        // Colours the shared theme has no name for, because only a market needs them.

        /// <summary>Every other row, so a long list reads as rows and not as a wall.</summary>
        private static readonly Color RowAltColor = new Color(0.937f, 0.957f, 0.980f);

        /// <summary>Money. On a page about money it should be the first thing found.</summary>
        private static readonly Color MoneyColor = new Color(0.451f, 0.310f, 0.055f);

        /// <summary>Under an hour left. Meant to read as "decide now", not as an error.</summary>
        private static readonly Color UrgentColor = new Color(0.647f, 0.243f, 0.094f);

        /// <summary>A bid of yours that is leading.</summary>
        private static readonly Color WinningColor = new Color(0.106f, 0.412f, 0.208f);

        /// <summary>The bar down the left of a row that has something to do with you.</summary>
        private const float StripeWidth = 3f;

        /// <summary>
        /// The server's limit of one at a time, mirrored so a button can say so.
        ///
        /// The server is what enforces it - this only decides what the button says, so the
        /// two being out of step costs a refusal message rather than a duplicated item.
        /// </summary>
        private const int MaxListings = 1;

        private const int MaxBuyOrders = 1;

        /// <summary>
        /// How many bids the server sends back for one listing.
        ///
        /// Mirrored so the heading can say when it is showing a capped list rather than a
        /// complete one. Being wrong about it costs a slightly odd heading, nothing more.
        /// </summary>
        private const int HistoryCap = 20;

        /// <summary>Where the list starts, under the title bar, the tabs and the tool row.</summary>
        private const float BodyTop = ModernUiTheme.TitleBarHeight + TabHeight + TabGap
                                      + ToolRowHeight + TabGap;

        /// <summary>The server's own choices, kept here so the buttons can offer exactly them.</summary>
        private static readonly int[] DurationChoices = { 8, 24, 48 };

        /// <summary>The server's own fee, so the confirmation can say the real number.</summary>
        private const int BuyOrderFeePercent = 5;

        /// <summary>How many search results are worth scrolling through.</summary>
        private const int MaxSearchResults = 40;

        /// <summary>Asked for again on this cadence while a page that goes stale is open.</summary>
        private const float RefreshInterval = 10f;

        /// <summary>
        /// How long a page waits for an answer before saying it did not get one.
        ///
        /// Every one of these requests is answered or it is not; there is no partial
        /// state. Without this the page that was never answered looks exactly like the
        /// page that is still loading, forever - which is a bug report that says "it says
        /// loading" and nothing else. Shorter than the refresh above, so the retry that
        /// follows is the automatic one.
        /// </summary>
        private const float AnswerTimeout = 6f;

        private enum Page
        {
            Browse,
            Buying,
            Mine,
            Parcels,
        }

        /// <summary>How far through listing something the player is.</summary>
        private enum SellStage
        {
            NotSelling,
            PickingItem,
            PickingDuration,
        }

        /// <summary>Whether the buy page is showing orders or the list of things to want.</summary>
        private enum BuyStage
        {
            NotPosting,
            PickingItem,
        }

        private static MarketWindow instance;

        private RectTransform body;
        private RectTransform toolRow;
        private TextMeshProUGUI subtitle;
        private readonly List<Button> tabButtons = new List<Button>();
        private readonly List<GameObject> rows = new List<GameObject>();

        private Page page = Page.Browse;
        private SellStage selling = SellStage.NotSelling;
        private int pendingBagId;
        private int pendingCount;
        private int pendingPrice;
        private string pendingName = "";

        private BuyStage posting = BuyStage.NotPosting;
        private readonly List<RebuildSharedData.ClientTypes.ItemData> searchMatches = new();

        /// <summary>How many the search actually found, before the list was cut down.</summary>
        private int searchFound;

        /// <summary>
        /// Which listing has its own page open, or -1 for the list.
        ///
        /// A state on top of whichever page you came from rather than a page of its own,
        /// so going back puts you where you were - the board, or your own listings.
        /// </summary>
        private int viewingAuction = -1;

        /// <summary>
        /// That listing as it read when it was opened.
        ///
        /// Only drawn when the live one can no longer be found: it sold, or a refresh moved
        /// it off this page. The last thing known about it beats a blank page that says
        /// nothing at all about what was there a second ago.
        /// </summary>
        private AuctionEntry viewingSnapshot;

        private int drawnRevision = -1;
        private float refreshTimer;

        /// <summary>When the page on screen last asked, for the timeout above.</summary>
        private float askedAt;
        private bool reportedTimeout;

        /// <summary>
        /// When the listings on screen were sent, so the countdown can run down from there.
        ///
        /// The server sends how long is left rather than when a listing ends, because the
        /// two machines do not agree on what time it is - a clock three hours out reads as
        /// the whole feature being broken.
        /// </summary>
        private float listingStamp;

        // =====================================================================
        // Opening

        public static void Toggle()
        {
            if (instance != null && instance.gameObject.activeSelf)
            {
                instance.CloseWindow();
                return;
            }

            Open();
        }

        public static void Open()
        {
            if (instance == null)
                instance = Build();

            if (instance == null)
                return;

            instance.gameObject.SetActive(true);
            instance.MoveToTop();
            instance.FitWindowIntoPlayArea();

            //Opened on the list, never on whatever listing was being read last time - that
            //one has very likely ended since, and a stale page is a worse greeting than a
            //board that has moved on.
            instance.viewingAuction = -1;
            instance.Ask();
        }

        /// <summary>How many parcels are waiting, for anything that wants to show a badge.</summary>
        public static int ParcelsWaiting => MarketState.ParcelsWaiting;

        private static MarketWindow Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            //assembled inactive so nothing runs against a half built window
            var host = new GameObject("MarketWindow", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<MarketWindow>();
            window.CanCloseWithEscape = true;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, "ตลาด", "", ModernUiIcons.Bag);
            ModernUiTheme.AttachShadow(rect);

            window.subtitle = ModernUiTheme.CreateText(rect, "Note", "", ModernUiTheme.SizeSmall,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Right);
            window.subtitle.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(window.subtitle.rectTransform, new Vector2(1, 1),
                new Vector2(-52f, -30f), new Vector2(340f, 20f));

            window.BuildTabs(rect);

            window.toolRow = ModernUiTheme.CreateRect("Tools", rect);
            ModernUiTheme.Place(window.toolRow, new Vector2(0, 1),
                new Vector2(Pad, -(ModernUiTheme.TitleBarHeight + TabHeight + TabGap)),
                new Vector2(Width - Pad * 2f, ToolRowHeight));

            //A sunken tray, which is also what catches the drag that scrolls it: the gaps
            //between the rows would otherwise pass the pointer straight through.
            var viewport = ModernUiTheme.CreateCard(rect, "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Stretch(viewport, Pad, Pad, -Pad, -BodyTop);
            viewport.gameObject.AddComponent<RectMask2D>();

            window.body = ModernUiTheme.CreateRect("Rows", viewport);
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

        private void BuildTabs(RectTransform rect)
        {
            var labels = new[] { "ประมูล", "รับซื้อ", "ของฉัน", "กล่องพัสดุ" };
            var width = (Width - Pad * 2f - TabGap * (labels.Length - 1)) / labels.Length;

            for (var i = 0; i < labels.Length; i++)
            {
                var which = (Page)i;
                var tab = ModernUiTheme.CreateButton(rect, "Tab" + i, labels[i],
                    ModernUiTheme.TabIdleColor, ModernUiTheme.NameColor, ModernUiTheme.SizeLabel);
                ModernUiTheme.Place((RectTransform)tab.transform, new Vector2(0, 1),
                    new Vector2(Pad + i * (width + TabGap), -ModernUiTheme.TitleBarHeight),
                    new Vector2(width, TabHeight));
                tab.onClick.AddListener(() => Select(which));
                tabButtons.Add(tab);
            }
        }

        // =====================================================================
        // Asking, and noticing the answer

        private void Select(Page which)
        {
            page = which;
            selling = SellStage.NotSelling;
            posting = BuyStage.NotPosting;
            viewingAuction = -1;
            Ask();
            Redraw();
        }

        /// <summary>Asks the server for whatever the page on screen is showing.</summary>
        private void Ask()
        {
            var net = NetworkManager.Instance;
            if (net == null)
                return;

            refreshTimer = RefreshInterval;
            askedAt = Time.realtimeSinceStartup;
            reportedTimeout = false;

            //Asked for alongside the list underneath, so an open listing's bids keep up
            //with it instead of freezing at whatever they were when it was opened. This is
            //the whole point of showing them: somebody else bidding is the news.
            if (viewingAuction >= 0)
                net.SendAuctionAction(AuctionRequestType.History, viewingAuction);

            switch (page)
            {
                case Page.Browse:
                    net.SendAuctionBrowse(MarketState.BrowseSearch, MarketState.BrowsePage);
                    break;
                case Page.Buying:
                    net.SendBuyOrderBrowse(MarketState.BuySearch, MarketState.BuyPage);
                    //and what this character has standing, so the post button knows when it
                    //is already at its one and the list can mark your own row
                    net.SendBuyOrderAction(BuyOrderRequestType.Mine);
                    break;
                case Page.Mine:
                    //Both, because the page shows both - what you are selling and what you
                    //are buying are the same question: what have I got going right now.
                    net.SendAuctionAction(AuctionRequestType.Mine);
                    net.SendBuyOrderAction(BuyOrderRequestType.Mine);
                    break;
                case Page.Parcels:
                    net.SendInboxAction(InboxRequestType.Refresh);
                    break;
            }
        }

        private void Update()
        {
            if (drawnRevision != MarketState.Revision)
            {
                //stamped on arrival, not on drawing: the countdown is measured from when
                //the server said it, and a redraw a minute later must not reset it
                listingStamp = Time.realtimeSinceStartup;
                Redraw();
            }

            //One redraw when the wait turns into a failure, not one every frame after it
            if (!reportedTimeout && !HasAnswer && Time.realtimeSinceStartup - askedAt > AnswerTimeout)
            {
                reportedTimeout = true;
                Redraw();
            }

            refreshTimer -= Time.deltaTime;
            if (refreshTimer <= 0f)
            {
                //Only the auction pages go stale on their own - somebody else can bid at
                //any moment. The parcel box only changes when this player does something,
                //or when a listing settles, and both of those send an answer of their own.
                if (page != Page.Parcels)
                    Ask();
                else
                    refreshTimer = RefreshInterval;
            }
        }

        /// <summary>Whether the page on screen has been answered at least once.</summary>
        private bool HasAnswer
        {
            get
            {
                //an open listing is answered by its own request, not by the page under it
                if (viewingAuction >= 0)
                    return MarketState.HistoryFor == viewingAuction;

                switch (page)
                {
                    case Page.Browse: return MarketState.ListingsReceived;
                    case Page.Buying: return MarketState.BuyOrdersReceived;
                    case Page.Mine: return MarketState.MineReceived && MarketState.MyBuyOrdersReceived;
                    case Page.Parcels: return MarketState.ParcelsReceived;
                    default: return true;
                }
            }
        }

        /// <summary>
        /// What to show in place of a list that has not arrived: still waiting, or waited
        /// and got nothing. Draws the note and returns, so the caller stops there.
        /// </summary>
        private void DrawWaiting()
        {
            var late = Time.realtimeSinceStartup - askedAt > AnswerTimeout;
            BuildNote(late ? "เซิร์ฟเวอร์ไม่ตอบ กำลังลองใหม่..." : "กำลังโหลด...", -RowGap);
            body.sizeDelta = new Vector2(0, RowHeight);

            if (!late)
                return;

            var retry = ModernUiTheme.CreateButton(toolRow, "Retry", "ลองใหม่",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)retry.transform, new Vector2(1, 0.5f),
                new Vector2(0f, 0f), new Vector2(80f, ToolRowHeight - 2f));
            retry.onClick.AddListener(Ask);
        }

        // =====================================================================
        // Drawing

        private void Redraw()
        {
            drawnRevision = MarketState.Revision;

            foreach (var row in rows)
                if (row != null)
                    Destroy(row);
            rows.Clear();

            for (var i = 0; i < toolRow.childCount; i++)
                Destroy(toolRow.GetChild(i).gameObject);

            PaintTabs();

            //One listing's own page sits on top of whichever list it was opened from, so
            //going back returns you to the board or to your own listings, as the case was.
            if (viewingAuction >= 0 && (page == Page.Browse || page == Page.Mine))
            {
                DrawAuctionDetail();
                return;
            }

            switch (page)
            {
                case Page.Browse:
                    DrawBrowse();
                    break;
                case Page.Buying:
                    if (posting == BuyStage.PickingItem)
                        DrawWantPicker();
                    else
                        DrawBuying();
                    break;
                case Page.Mine:
                    if (selling == SellStage.PickingItem)
                        DrawSellPicker();
                    else if (selling == SellStage.PickingDuration)
                        DrawDurationPicker();
                    else
                        DrawMine();
                    break;
                case Page.Parcels:
                    DrawParcels();
                    break;
            }
        }

        private void PaintTabs()
        {
            for (var i = 0; i < tabButtons.Count; i++)
            {
                var image = tabButtons[i].GetComponent<Image>();
                var active = (Page)i == page;
                image.color = active ? ModernUiTheme.AccentColor : ModernUiTheme.TabIdleColor;

                var label = tabButtons[i].GetComponentInChildren<TextMeshProUGUI>();
                if (label == null)
                    continue;

                label.color = active ? ModernUiTheme.LightInkColor : ModernUiTheme.NameColor;

                //the badge belongs on the tab rather than in the page, so it is visible
                //from the other two - which is the only time it is worth anything
                if ((Page)i == Page.Parcels)
                    label.text = MarketState.ParcelsWaiting > 0
                        ? $"กล่องพัสดุ ({MarketState.ParcelsWaiting})"
                        : "กล่องพัสดุ";
            }
        }

        private void DrawBrowse()
        {
            var search = ModernUiTheme.CreateButton(toolRow, "Search",
                string.IsNullOrEmpty(MarketState.BrowseSearch)
                    ? "ค้นหา"
                    : $"ค้นหา: {MarketState.BrowseSearch}",
                ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)search.transform, new Vector2(0, 0.5f),
                new Vector2(0f, 0f), new Vector2(200f, ToolRowHeight - 2f));
            search.onClick.AddListener(AskForSearch);

            if (!string.IsNullOrEmpty(MarketState.BrowseSearch))
            {
                var clear = ModernUiTheme.CreateButton(toolRow, "Clear", "ล้าง",
                    ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)clear.transform, new Vector2(0, 0.5f),
                    new Vector2(206f, 0f), new Vector2(56f, ToolRowHeight - 2f));
                clear.onClick.AddListener(() =>
                {
                    MarketState.BrowseSearch = "";
                    MarketState.BrowsePage = 0;
                    Ask();
                });
            }

            BuildPager();

            var y = -RowGap;
            if (!MarketState.ListingsReceived)
            {
                DrawWaiting();
                return;
            }

            if (MarketState.Listings.Count == 0)
            {
                BuildNote(string.IsNullOrEmpty(MarketState.BrowseSearch)
                    ? "ยังไม่มีใครตั้งประมูล  ·  ไปแท็บ ของฉัน เพื่อเป็นคนแรก"
                    : "ไม่พบของที่ค้นหา", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            var index = 0;
            foreach (var entry in MarketState.Listings)
            {
                BuildListingRow(entry, y, false, index++);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        private void BuildPager()
        {
            var pageSize = 20;
            var pages = (MarketState.BrowseTotal + pageSize - 1) / pageSize;
            if (pages < 1)
                pages = 1;

            var counts = $"ทั้งหมด {MarketState.BrowseTotal:N0} รายการ  ·  หน้า {MarketState.BrowsePage + 1}/{pages}";

            //Said only while there is something to tap. On an empty board it would be an
            //instruction for a thing that is not there.
            subtitle.text = MarketState.Listings.Count > 0
                ? counts + "  ·  แตะที่รายการเพื่อดูคนบิด"
                : counts;

            if (MarketState.BrowsePage > 0)
            {
                var prev = ModernUiTheme.CreateButton(toolRow, "Prev", "ก่อนหน้า",
                    ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)prev.transform, new Vector2(1, 0.5f),
                    new Vector2(-86f, 0f), new Vector2(80f, ToolRowHeight - 2f));
                prev.onClick.AddListener(() =>
                {
                    MarketState.BrowsePage--;
                    Ask();
                });
            }

            if (MarketState.BrowsePage + 1 < pages)
            {
                var next = ModernUiTheme.CreateButton(toolRow, "Next", "ถัดไป",
                    ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)next.transform, new Vector2(1, 0.5f),
                    new Vector2(0f, 0f), new Vector2(80f, ToolRowHeight - 2f));
                next.onClick.AddListener(() =>
                {
                    MarketState.BrowsePage++;
                    Ask();
                });
            }
        }

        private void AskForSearch()
        {
            UiManager.Instance.TextInputWindow.BeginTextInput("ค้นหาชื่อของ (เว้นว่างเพื่อดูทั้งหมด)",
                text =>
                {
                    MarketState.BrowseSearch = text == null ? "" : text.Trim();
                    MarketState.BrowsePage = 0;
                    Ask();
                });
        }

        private void DrawMine()
        {
            //Counted rather than taken from the list's length: this page also carries the
            //listings you are merely leading, and those are somebody else's one, not yours.
            var listed = 0;
            foreach (var mine in MarketState.Mine)
                if (mine.IsMine)
                    listed++;

            //The server refuses a second one and hands the item straight back, but the trip
            //there is four taps and a parcel to collect afterwards. So the button says why
            //instead of leading somewhere that can only end in a refusal.
            var full = MarketState.MineReceived && listed >= MaxListings;
            var sell = ModernUiTheme.CreateButton(toolRow, "Sell",
                full ? "ตั้งครบแล้ว" : "ตั้งประมูล",
                full ? ModernUiTheme.CardDeepColor : ModernUiTheme.AccentColor,
                full ? ModernUiTheme.MutedColor : ModernUiTheme.LightInkColor,
                ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)sell.transform, new Vector2(0, 0.5f),
                new Vector2(0f, 0f), new Vector2(110f, ToolRowHeight - 2f));
            sell.onClick.AddListener(() =>
            {
                if (full)
                {
                    CameraFollower.Instance.AppendError(
                        $"ตั้งประมูลได้ครั้งละ {MaxListings} รายการ รอรายการเดิมจบก่อน");
                    return;
                }

                selling = SellStage.PickingItem;
                Redraw();
            });

            subtitle.text = $"ตั้งได้ครั้งละ {MaxListings} รายการ  ·  ค่าฝาก 1%  ·  ขายได้หัก 3%";

            var y = -RowGap;
            if (!MarketState.MineReceived)
            {
                DrawWaiting();
                return;
            }

            if (MarketState.Mine.Count == 0 && MarketState.MyBuyOrders.Count == 0)
            {
                BuildNote("ยังไม่ได้ตั้งประมูล ตั้งรับซื้อ หรือบิดอะไร", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            if (MarketState.Mine.Count > 0)
            {
                BuildHeading("ประมูล", y);
                y -= HeadingHeight + RowGap;

                var index = 0;
                foreach (var entry in MarketState.Mine)
                {
                    BuildListingRow(entry, y, true, index++);
                    y -= RowHeight + RowGap;
                }
            }

            //Both halves on one page: what you are selling and what you are buying are the
            //same question - what have I got going right now.
            if (MarketState.MyBuyOrders.Count > 0)
            {
                y -= RowGap;
                BuildHeading("รับซื้อ", y);
                y -= HeadingHeight + RowGap;

                var index = 0;
                foreach (var order in MarketState.MyBuyOrders)
                {
                    BuildBuyOrderRow(order, y, true, index++);
                    y -= RowHeight + RowGap;
                }
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        /// <summary>
        /// One listing: what it is, where the bidding is, and the one thing you can do
        /// about it.
        ///
        /// Which button appears is decided from who owns it rather than from which page it
        /// is on, so a listing of your own that turns up in a search is not offered a bid
        /// button the server would only refuse.
        ///
        /// The row itself is a button as well, opening the listing's own page. The bid and
        /// cancel buttons sit on top of it and are hit first - which is what makes a tap on
        /// the right of a row act on it, and a tap anywhere else look at it.
        /// </summary>
        private void BuildListingRow(AuctionEntry entry, float y, bool ownPage, int index)
        {
            var row = NewRow(y, index);
            var data = ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetItemById(entry.Item.ItemId)
                : null;

            RowIcon(row, data);

            //A bar down the left for the rows that are about you: the ones you put up, and
            //the ones you are currently winning. On a board of forty rows that is the only
            //thing anybody is scanning for.
            var leading = entry.HighBid > 0 && IsMe(entry.HighBidderName);
            if (entry.IsMine)
                Stripe(row, ModernUiTheme.AccentColor);
            else if (leading)
                Stripe(row, WinningColor);

            var name = ModernUiTheme.CreateText(row, "Name", ItemLabel(entry.Item, data),
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -5f), new Vector2(LabelWidth, 18f));

            string who;
            var tint = ModernUiTheme.MutedColor;

            if (leading)
            {
                who = "คุณนำอยู่";
                tint = WinningColor;
            }
            else if (entry.HighBid > 0)
                who = $"{entry.HighBidderName} นำอยู่";
            else
                who = "ยังไม่มีคนบิด";

            if (!entry.IsMine && !ownPage)
                who += $"  ·  ขายโดย {entry.SellerName}";

            var under = ModernUiTheme.CreateText(row, "Who", who,
                ModernUiTheme.SizeSmall, tint, TextAlignmentOptions.TopLeft);
            under.textWrappingMode = TextWrappingModes.NoWrap;
            under.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(under.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -21f), new Vector2(LabelWidth, 16f));

            //The price gets a column of its own rather than a place in a sentence. It is
            //the number every one of these rows is really about, and reading it off the end
            //of a line of words means reading the words first.
            var left = SecondsLeft(entry);
            MoneyColumn(row, $"{(entry.HighBid > 0 ? entry.HighBid : entry.StartPrice):N0} Zeny",
                TimeLeftText(left), left > 0 && left < 3600 ? UrgentColor : ModernUiTheme.MutedColor);

            var opened = entry;
            MakeRowClickable(row, () => OpenListing(opened));

            if (entry.IsMine)
            {
                //Only one with nothing bid on it can come down. The server refuses the rest,
                //so offering the button would only ever produce a refusal.
                if (entry.HighBid > 0)
                    return;

                var id = entry.Id;
                var cancel = ModernUiTheme.CreateButton(row, "Cancel", "ยกเลิก",
                    ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)cancel.transform, new Vector2(1, 0.5f),
                    new Vector2(-8f, 0f), new Vector2(ActionWidth, RowHeight - 10f));
                cancel.onClick.AddListener(() =>
                    NetworkManager.Instance.SendAuctionAction(AuctionRequestType.Cancel, id));
                return;
            }

            var bid = ModernUiTheme.CreateButton(row, "Bid", "บิด",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)bid.transform, new Vector2(1, 0.5f),
                new Vector2(-8f, 0f), new Vector2(ActionWidth, RowHeight - 10f));

            var captured = entry;
            bid.onClick.AddListener(() => AskForBid(captured));
        }

        /// <summary>Opens one listing's own page, and asks who has bid on it.</summary>
        private void OpenListing(AuctionEntry entry)
        {
            viewingAuction = entry.Id;
            viewingSnapshot = entry;

            //Emptied rather than left showing the last listing's bids, which would otherwise
            //be drawn under this one's name for as long as the answer takes to arrive.
            MarketState.History.Clear();
            MarketState.HistoryFor = -1;

            Ask();
            Redraw();
        }

        // =====================================================================
        // One listing on its own

        /// <summary>
        /// Everything known about one listing, which is mostly who has been bidding on it.
        ///
        /// The numbers are not the point - the row already showed the leading bid. The
        /// point is that four different people bid on this in the last ten minutes, which
        /// is the difference between a noticeboard and a market, and no single row can say
        /// it.
        /// </summary>
        private void DrawAuctionDetail()
        {
            var entry = FindViewed();

            var back = ModernUiTheme.CreateButton(toolRow, "BackDetail", "ย้อนกลับ",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)back.transform, new Vector2(0, 0.5f),
                new Vector2(0f, 0f), new Vector2(90f, ToolRowHeight - 2f));
            back.onClick.AddListener(() =>
            {
                viewingAuction = -1;
                Ask();
                Redraw();
            });

            if (entry == null)
            {
                //Between the tap and the answer it can have sold. Saying so beats an empty
                //page, and beats leaving the last owner's numbers on screen.
                subtitle.text = "";
                BuildNote("รายการนี้จบไปแล้ว", -RowGap);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            if (!entry.IsMine)
            {
                var bid = ModernUiTheme.CreateButton(toolRow, "BidDetail",
                    $"บิด {entry.MinimumBid:N0} Zeny", ModernUiTheme.AccentColor,
                    ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)bid.transform, new Vector2(1, 0.5f),
                    new Vector2(0f, 0f), new Vector2(170f, ToolRowHeight - 2f));

                var captured = entry;
                bid.onClick.AddListener(() => AskForBid(captured));
            }
            else if (entry.HighBid <= 0)
            {
                //Only one nobody has bid on can come down, the same rule as on the row.
                var id = entry.Id;
                var cancel = ModernUiTheme.CreateButton(toolRow, "CancelDetail", "ยกเลิกรายการ",
                    ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)cancel.transform, new Vector2(1, 0.5f),
                    new Vector2(0f, 0f), new Vector2(120f, ToolRowHeight - 2f));
                cancel.onClick.AddListener(() =>
                {
                    NetworkManager.Instance.SendAuctionAction(AuctionRequestType.Cancel, id);
                    viewingAuction = -1;
                    Redraw();
                });
            }

            subtitle.text = entry.IsMine ? "รายการของคุณ" : $"ผู้ขาย {entry.SellerName}";

            var y = -RowGap;
            BuildDetailHead(entry, y);
            y -= DetailHeight + RowGap * 2f;

            if (MarketState.HistoryFor != viewingAuction)
            {
                var late = Time.realtimeSinceStartup - askedAt > AnswerTimeout;
                BuildNote(late ? "เซิร์ฟเวอร์ไม่ตอบ กำลังลองใหม่..." : "กำลังโหลด...", y);
                body.sizeDelta = new Vector2(0, -y + RowHeight);
                return;
            }

            var bids = MarketState.History.Count;

            //The server sends the last twenty and no more. Where it is exactly twenty that
            //is worth saying, otherwise a listing fought over all day reads as one that was
            //bid on twenty times.
            BuildHeading(bids >= HistoryCap ? $"คนที่บิด ({HistoryCap} ครั้งล่าสุด)"
                : bids > 0 ? $"คนที่บิด ({bids} ครั้ง)" : "คนที่บิด", y);
            y -= HeadingHeight + RowGap;

            if (bids == 0)
            {
                BuildNote(entry.IsMine ? "ยังไม่มีใครบิด" : "ยังไม่มีใครบิด เป็นคนแรกได้เลย", y);
                body.sizeDelta = new Vector2(0, -y + RowHeight);
                return;
            }

            var index = 0;
            foreach (var made in MarketState.History)
            {
                BuildBidRow(made, y, index, index == 0);
                index++;
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        /// <summary>
        /// The listing being read, as it last came off the wire.
        ///
        /// Looked up again on each redraw rather than held onto, because the one thing on
        /// it worth watching - the leading bid - changes underneath while the page is open.
        /// What it was when it was opened is the fallback, which beats a blank page.
        /// </summary>
        private AuctionEntry FindViewed()
        {
            foreach (var entry in MarketState.Listings)
                if (entry.Id == viewingAuction)
                    return entry;

            foreach (var entry in MarketState.Mine)
                if (entry.Id == viewingAuction)
                    return entry;

            return viewingSnapshot != null && viewingSnapshot.Id == viewingAuction
                ? viewingSnapshot
                : null;
        }

        /// <summary>The listing itself, above its bids: what it is, whose, and for how much.</summary>
        private void BuildDetailHead(AuctionEntry entry, float y)
        {
            var card = ModernUiTheme.CreateCard(body, "Head", ModernUiTheme.CardDeepColor);
            card.anchorMin = new Vector2(0, 1);
            card.anchorMax = new Vector2(1, 1);
            card.pivot = new Vector2(0.5f, 1);
            card.sizeDelta = new Vector2(-RowGap * 2f, DetailHeight);
            card.anchoredPosition = new Vector2(0, y);
            card.GetComponent<Image>().raycastTarget = false;
            rows.Add(card.gameObject);

            var data = ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetItemById(entry.Item.ItemId)
                : null;

            if (data != null && ClientDataLoader.Instance != null)
            {
                var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(data.Code);
                if (sprite != null)
                {
                    var icon = ModernUiTheme.CreateIcon(card, sprite, Color.white, 44f);
                    ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f),
                        new Vector2(12f, 0f), new Vector2(44f, 44f));
                }
            }

            var name = ModernUiTheme.CreateText(card, "Name", ItemLabel(entry.Item, data),
                ModernUiTheme.SizeBody, ModernUiTheme.TitleColor, TextAlignmentOptions.TopLeft,
                FontStyles.Bold);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                new Vector2(64f, -10f), new Vector2(Width - 284f, 22f));

            var left = SecondsLeft(entry);
            var who = ModernUiTheme.CreateText(card, "Who",
                entry.HighBid > 0
                    ? $"{entry.HighBidderName} นำอยู่  ·  {TimeLeftText(left)}"
                    : $"ยังไม่มีคนบิด  ·  {TimeLeftText(left)}",
                ModernUiTheme.SizeSmall,
                left > 0 && left < 3600 ? UrgentColor : ModernUiTheme.LabelColor,
                TextAlignmentOptions.TopLeft);
            who.textWrappingMode = TextWrappingModes.NoWrap;
            who.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(who.rectTransform, new Vector2(0, 1),
                new Vector2(64f, -36f), new Vector2(Width - 284f, 18f));

            //Bigger here than on a row, because on this page the number is the subject
            var money = ModernUiTheme.CreateText(card, "Money",
                $"{(entry.HighBid > 0 ? entry.HighBid : entry.StartPrice):N0} Zeny",
                ModernUiTheme.SizeValue, MoneyColor, TextAlignmentOptions.TopRight,
                FontStyles.Bold);
            money.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(money.rectTransform, new Vector2(1, 1),
                new Vector2(-12f, -10f), new Vector2(200f, 26f));

            var label = ModernUiTheme.CreateText(card, "MoneyLabel",
                entry.HighBid > 0 ? $"บิดต่อไปอย่างน้อย {entry.MinimumBid:N0}" : "ราคาเริ่มต้น",
                ModernUiTheme.SizeSmall, ModernUiTheme.LabelColor, TextAlignmentOptions.TopRight);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(label.rectTransform, new Vector2(1, 1),
                new Vector2(-12f, -38f), new Vector2(200f, 16f));
        }

        /// <summary>One bid: who made it, how much, how long ago, and whether it still leads.</summary>
        private void BuildBidRow(AuctionBidEntry made, float y, int index, bool leading)
        {
            var row = NewRow(y, index);
            var mine = IsMe(made.BidderName);

            if (leading)
                Stripe(row, WinningColor);
            else if (mine)
                Stripe(row, ModernUiTheme.AccentColor);

            var name = ModernUiTheme.CreateText(row, "Bidder",
                mine ? $"{made.BidderName} (คุณ)" : made.BidderName,
                ModernUiTheme.SizeLabel,
                leading ? WinningColor : ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft,
                leading ? FontStyles.Bold : FontStyles.Normal);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                new Vector2(16f, -5f), new Vector2(LabelWidth, 18f));

            var ago = ModernUiTheme.CreateText(row, "Ago", TimeAgoText(made.SecondsAgo),
                ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
            ago.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(ago.rectTransform, new Vector2(0, 1),
                new Vector2(16f, -21f), new Vector2(LabelWidth, 16f));

            MoneyColumn(row, $"{made.Amount:N0} Zeny", leading ? "นำอยู่" : "ถูกแซงแล้ว",
                leading ? WinningColor : ModernUiTheme.MutedColor, 12f);
        }

        private void AskForBid(AuctionEntry entry)
        {
            var minimum = entry.MinimumBid;
            UiManager.Instance.TextInputWindow.BeginTextInput(
                $"บิดเท่าไหร่ (อย่างน้อย {minimum:N0} Zeny)", text =>
                {
                    if (!int.TryParse(text, out var amount) || amount <= 0)
                    {
                        CameraFollower.Instance.AppendError("ใส่เป็นตัวเลขเท่านั้น");
                        return;
                    }

                    //The server checks this again and refunds; this is so a bid that was
                    //never going to lead does not take a round trip through the parcel box.
                    if (amount < minimum)
                    {
                        CameraFollower.Instance.AppendError($"ต้องบิดอย่างน้อย {minimum:N0} Zeny");
                        return;
                    }

                    NetworkManager.Instance.SendAuctionAction(AuctionRequestType.Bid, entry.Id, amount);
                });
        }

        // =====================================================================
        // Standing offers to buy

        private void DrawBuying()
        {
            //Same as the sell button on the other page: one at a time, and the button is
            //where that is said, rather than at the end of a flow that takes money first.
            var full = MarketState.MyBuyOrdersReceived
                       && MarketState.MyBuyOrders.Count >= MaxBuyOrders;
            var post = ModernUiTheme.CreateButton(toolRow, "Post",
                full ? "ตั้งครบแล้ว" : "ตั้งรับซื้อ",
                full ? ModernUiTheme.CardDeepColor : ModernUiTheme.AccentColor,
                full ? ModernUiTheme.MutedColor : ModernUiTheme.LightInkColor,
                ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)post.transform, new Vector2(0, 0.5f),
                new Vector2(0f, 0f), new Vector2(96f, ToolRowHeight - 2f));
            post.onClick.AddListener(() =>
            {
                if (full)
                {
                    CameraFollower.Instance.AppendError(
                        $"ตั้งรับซื้อได้ครั้งละ {MaxBuyOrders} รายการ ยกเลิกรายการเดิมก่อน");
                    return;
                }

                AskWhatToWant();
            });

            var search = ModernUiTheme.CreateButton(toolRow, "SearchBuy",
                string.IsNullOrEmpty(MarketState.BuySearch)
                    ? "ค้นหา"
                    : $"ค้นหา: {MarketState.BuySearch}",
                ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)search.transform, new Vector2(0, 0.5f),
                new Vector2(102f, 0f), new Vector2(160f, ToolRowHeight - 2f));
            search.onClick.AddListener(() =>
                UiManager.Instance.TextInputWindow.BeginTextInput(
                    "ค้นหาของที่มีคนรับซื้อ (เว้นว่างเพื่อดูทั้งหมด)", text =>
                    {
                        MarketState.BuySearch = text == null ? "" : text.Trim();
                        MarketState.BuyPage = 0;
                        Ask();
                    }));

            BuildBuyPager();

            var y = -RowGap;
            if (!MarketState.BuyOrdersReceived)
            {
                DrawWaiting();
                return;
            }

            if (MarketState.BuyOrders.Count == 0)
            {
                BuildNote(string.IsNullOrEmpty(MarketState.BuySearch)
                    ? "ยังไม่มีใครตั้งรับซื้อ  ·  กดปุ่ม ตั้งรับซื้อ เพื่อเป็นคนแรก"
                    : "ไม่มีใครรับซื้อของชิ้นนี้", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            var index = 0;
            foreach (var order in MarketState.BuyOrders)
            {
                BuildBuyOrderRow(order, y, false, index++);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        private void BuildBuyPager()
        {
            var pages = (MarketState.BuyTotal + 19) / 20;
            if (pages < 1)
                pages = 1;

            subtitle.text = $"รับซื้ออยู่ {MarketState.BuyTotal:N0} รายการ  ·  หน้า {MarketState.BuyPage + 1}/{pages}"
                            + $"  ·  ตั้งได้ครั้งละ {MaxBuyOrders} รายการ";

            if (MarketState.BuyPage > 0)
            {
                var prev = ModernUiTheme.CreateButton(toolRow, "PrevBuy", "ก่อนหน้า",
                    ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)prev.transform, new Vector2(1, 0.5f),
                    new Vector2(-86f, 0f), new Vector2(80f, ToolRowHeight - 2f));
                prev.onClick.AddListener(() =>
                {
                    MarketState.BuyPage--;
                    Ask();
                });
            }

            if (MarketState.BuyPage + 1 < pages)
            {
                var next = ModernUiTheme.CreateButton(toolRow, "NextBuy", "ถัดไป",
                    ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)next.transform, new Vector2(1, 0.5f),
                    new Vector2(0f, 0f), new Vector2(80f, ToolRowHeight - 2f));
                next.onClick.AddListener(() =>
                {
                    MarketState.BuyPage++;
                    Ask();
                });
            }
        }

        /// <summary>
        /// One standing offer: what is wanted, how much of it is left, and what it pays.
        ///
        /// The sell button is only offered when there is actually something in the bag to
        /// sell into it, because a button whose only outcome is "you have none of those"
        /// is a button that wastes a tap and teaches nothing. Your own order gets none
        /// either - the server refuses selling to yourself, and rightly.
        /// </summary>
        private void BuildBuyOrderRow(BuyOrderEntry order, float y, bool ownPage, int index)
        {
            var row = NewRow(y, index);
            var data = ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetItemById(order.ItemId)
                : null;

            RowIcon(row, data);

            var mine = ownPage || IsMe(order.BuyerName);
            if (mine)
                Stripe(row, ModernUiTheme.AccentColor);

            var name = ModernUiTheme.CreateText(row, "Name",
                data != null ? data.Name : $"#{order.ItemId}",
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -5f), new Vector2(LabelWidth, 18f));

            var detail = $"รับอีก {order.RemainingCount:N0}/{order.WantedCount:N0} ชิ้น";
            if (!ownPage)
                detail += mine ? "  ·  ของคุณเอง" : $"  ·  โดย {order.BuyerName}";

            var under = ModernUiTheme.CreateText(row, "Detail", detail,
                ModernUiTheme.SizeSmall, mine ? ModernUiTheme.LabelColor : ModernUiTheme.MutedColor,
                TextAlignmentOptions.TopLeft);
            under.textWrappingMode = TextWrappingModes.NoWrap;
            under.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(under.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -21f), new Vector2(LabelWidth, 16f));

            //Per piece, not the total: what a seller is deciding is whether to hand over one
            //of these, and the total on the order is not the number that answers that.
            MoneyColumn(row, $"ชิ้นละ {order.PricePer:N0} Zeny", TimeLeftText(order.SecondsLeft),
                order.SecondsLeft > 0 && order.SecondsLeft < 3600
                    ? UrgentColor
                    : ModernUiTheme.MutedColor);

            if (ownPage)
            {
                var id = order.Id;
                var cancel = ModernUiTheme.CreateButton(row, "CancelBuy", "ยกเลิก",
                    ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)cancel.transform, new Vector2(1, 0.5f),
                    new Vector2(-8f, 0f), new Vector2(ActionWidth, RowHeight - 10f));
                cancel.onClick.AddListener(() => NetworkManager.Instance.SendBuyOrderCancel(id));
                return;
            }

            if (mine)
                return;

            if (!TryFindStack(order.ItemId, out var bagId, out var have))
                return;

            var sell = ModernUiTheme.CreateButton(row, "SellInto", "ขาย",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)sell.transform, new Vector2(1, 0.5f),
                new Vector2(-8f, 0f), new Vector2(ActionWidth, RowHeight - 10f));

            var captured = order;
            var slot = bagId;
            var owned = have;
            sell.onClick.AddListener(() => AskHowManyToSell(captured, slot, owned));
        }

        /// <summary>
        /// The first stack of this item in the bag that is not being worn.
        ///
        /// Only regular items: an order names a thing by its number, and gear that shares
        /// a number can be worth wildly different amounts - the server refuses those, so
        /// they are not offered here either.
        /// </summary>
        private static bool TryFindStack(int itemId, out int bagId, out int count)
        {
            bagId = 0;
            count = 0;

            var state = PlayerState.Instance;
            var bag = state != null ? state.Inventory : null;
            if (bag == null)
                return false;

            foreach (var (id, item) in bag.GetInventoryData())
            {
                if (item.Type != ItemType.RegularItem || item.ItemData == null)
                    continue;
                if (item.ItemData.Id != itemId)
                    continue;
                if (state.EquippedBagIdHashes.Contains(id))
                    continue;

                bagId = id;
                count = item.Count;
                return count > 0;
            }

            return false;
        }

        private void AskHowManyToSell(BuyOrderEntry order, int bagId, int owned)
        {
            var most = owned < order.RemainingCount ? owned : order.RemainingCount;
            if (most <= 0)
                return;

            UiManager.Instance.TextInputWindow.BeginTextInput(
                $"ขายกี่ชิ้น (มี {owned:N0} · รับอีก {order.RemainingCount:N0} · "
                + $"ได้ชิ้นละ {order.PricePer:N0})", text =>
                {
                    if (!int.TryParse(text, out var wanted) || wanted <= 0)
                    {
                        CameraFollower.Instance.AppendError("ใส่เป็นตัวเลขเท่านั้น");
                        return;
                    }

                    //Cut down rather than refused. The server gives back anything the order
                    //cannot take anyway, so this only saves the round trip.
                    if (wanted > most)
                        wanted = most;

                    NetworkManager.Instance.SendBuyOrderSell(order.Id, bagId, wanted);
                });
        }

        // =====================================================================
        // Posting one

        private void AskWhatToWant()
        {
            UiManager.Instance.TextInputWindow.BeginTextInput("อยากรับซื้ออะไร (พิมพ์ชื่อของ)",
                text =>
                {
                    var needle = text == null ? "" : text.Trim();
                    if (needle.Length < 2)
                    {
                        CameraFollower.Instance.AppendError("พิมพ์อย่างน้อย 2 ตัวอักษร");
                        return;
                    }

                    //Searched against the item table the client already has, and what gets
                    //sent is the number of whatever is picked from it. Nothing typed here
                    //ever reaches the server - a name spelled wrong finds nothing rather
                    //than posting an order for something nobody meant.
                    searchMatches.Clear();
                    var loader = ClientDataLoader.Instance;
                    if (loader != null)
                    {
                        foreach (var (_, item) in loader.ItemIdLookup)
                        {
                            if (item?.Name == null || item.Id <= 0 || item.IsUnique)
                                continue; //gear belongs in the auction house
                            if (item.Name.IndexOf(needle, StringComparison.OrdinalIgnoreCase) < 0)
                                continue;

                            searchMatches.Add(item);
                        }
                    }

                    if (searchMatches.Count == 0)
                    {
                        CameraFollower.Instance.AppendError("ไม่พบของชิ้นนี้ หรือเป็นของที่ตั้งรับซื้อไม่ได้");
                        return;
                    }

                    //Collected in full, then ranked, then cut. Cutting while collecting made
                    //the cut in whatever order the table happens to be in, so searching for
                    //the exact name of a common thing could miss it entirely behind forty
                    //others that merely contain the word.
                    searchMatches.Sort((a, b) =>
                    {
                        var byRank = MatchRank(a.Name, needle).CompareTo(MatchRank(b.Name, needle));
                        return byRank != 0
                            ? byRank
                            : string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
                    });

                    searchFound = searchMatches.Count;
                    if (searchMatches.Count > MaxSearchResults)
                        searchMatches.RemoveRange(MaxSearchResults,
                            searchMatches.Count - MaxSearchResults);

                    posting = BuyStage.PickingItem;
                    Redraw();
                });
        }

        private void DrawWantPicker()
        {
            var back = ModernUiTheme.CreateButton(toolRow, "BackBuy", "ย้อนกลับ",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)back.transform, new Vector2(0, 0.5f),
                new Vector2(0f, 0f), new Vector2(90f, ToolRowHeight - 2f));
            back.onClick.AddListener(() =>
            {
                posting = BuyStage.NotPosting;
                Redraw();
            });

            subtitle.text = searchFound > searchMatches.Count
                ? $"เจอ {searchFound:N0} อย่าง แสดง {searchMatches.Count}  ·  ค่าธรรมเนียม {BuyOrderFeePercent}%"
                : $"เจอ {searchMatches.Count} อย่าง  ·  ค่าธรรมเนียม {BuyOrderFeePercent}%";

            var y = -RowGap;
            var index = 0;
            foreach (var item in searchMatches)
            {
                var row = NewRow(y, index++);

                if (ClientDataLoader.Instance != null)
                {
                    var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(item.Code);
                    if (sprite != null)
                    {
                        var size = RowHeight - 14f;
                        var icon = ModernUiTheme.CreateIcon(row, sprite, Color.white, size);
                        ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f),
                            new Vector2(IconInset, 0f), new Vector2(size, size));
                    }
                }

                var name = ModernUiTheme.CreateText(row, "Name", item.Name,
                    ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft);
                name.textWrappingMode = TextWrappingModes.NoWrap;
                name.overflowMode = TextOverflowModes.Ellipsis;
                ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                    new Vector2(TextInset, -5f), new Vector2(PlainWidth, 18f));

                //The number and what a shop pays, because a name on its own is not enough to
                //pick by - two things can read almost alike, and the number is what the
                //order is actually posted against.
                var hint = item.SellPrice > 0
                    ? $"#{item.Id}  ·  ขายร้านค้าได้ {item.SellPrice:N0} Zeny"
                    : $"#{item.Id}";
                var under = ModernUiTheme.CreateText(row, "Hint", hint,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
                under.textWrappingMode = TextWrappingModes.NoWrap;
                ModernUiTheme.Place(under.rectTransform, new Vector2(0, 1),
                    new Vector2(TextInset, -21f), new Vector2(PlainWidth, 16f));

                var pick = ModernUiTheme.CreateButton(row, "PickWant", "เลือก",
                    ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)pick.transform, new Vector2(1, 0.5f),
                    new Vector2(-8f, 0f), new Vector2(ActionWidth, RowHeight - 10f));

                var chosen = item;
                pick.onClick.AddListener(() => AskWantCount(chosen));

                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        /// <summary>
        /// How well a name answers what was typed: nought for the same name, one for a
        /// name starting with it, two for a name that merely contains it.
        ///
        /// So the thing somebody typed the name of comes first, rather than whichever of
        /// the forty things containing that word the table happened to reach first.
        /// </summary>
        private static int MatchRank(string name, string needle)
        {
            if (string.Equals(name, needle, StringComparison.OrdinalIgnoreCase))
                return 0;

            return name.StartsWith(needle, StringComparison.OrdinalIgnoreCase) ? 1 : 2;
        }

        private void AskWantCount(RebuildSharedData.ClientTypes.ItemData item)
        {
            UiManager.Instance.TextInputWindow.BeginTextInput($"รับซื้อ {item.Name} กี่ชิ้น",
                text =>
                {
                    if (!int.TryParse(text, out var count) || count <= 0)
                    {
                        CameraFollower.Instance.AppendError("ใส่เป็นตัวเลขเท่านั้น");
                        return;
                    }

                    AskWantPrice(item, count);
                });
        }

        private void AskWantPrice(RebuildSharedData.ClientTypes.ItemData item, int count)
        {
            UiManager.Instance.TextInputWindow.BeginTextInput(
                $"รับซื้อ {item.Name} ชิ้นละกี่ Zeny", text =>
                {
                    if (!int.TryParse(text, out var price) || price < 10)
                    {
                        CameraFollower.Instance.AppendError("ราคาต้องเป็นตัวเลข ไม่ต่ำกว่า 10 Zeny");
                        return;
                    }

                    //Said before it is taken, not after. The whole amount leaves the purse
                    //the moment this is posted, and that is not what somebody expects from
                    //a thing called an offer.
                    var held = (long)price * count;
                    var fee = held * BuyOrderFeePercent / 100;
                    Confirm($"รับซื้อ {item.Name} {count:N0} ชิ้น ชิ้นละ {price:N0} Zeny\n\n"
                            + $"หักตอนนี้ {held + fee:N0} Zeny\n"
                            + $"(มัดจำ {held:N0} + ค่าธรรมเนียม {fee:N0})\n\n"
                            + "มัดจำที่เหลือคืนเมื่อยกเลิกหรือหมดอายุ ค่าธรรมเนียมไม่คืน",
                        () =>
                        {
                            NetworkManager.Instance.SendBuyOrderCreate(item.Id, count, price);
                            posting = BuyStage.NotPosting;
                            Redraw();
                        });
                });
        }

        // =====================================================================
        // Listing something

        private void DrawSellPicker()
        {
            var back = ModernUiTheme.CreateButton(toolRow, "Back", "ย้อนกลับ",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)back.transform, new Vector2(0, 0.5f),
                new Vector2(0f, 0f), new Vector2(90f, ToolRowHeight - 2f));
            back.onClick.AddListener(() =>
            {
                selling = SellStage.NotSelling;
                Redraw();
            });

            subtitle.text = "เลือกของที่จะตั้งประมูล";

            var y = -RowGap;
            var state = PlayerState.Instance;
            var bag = state != null ? state.Inventory : null;
            var shown = 0;

            if (bag != null)
            {
                foreach (var (bagId, item) in bag.GetInventoryData())
                {
                    if (item.ItemData == null)
                        continue;

                    //what is on your back is not for sale; the server refuses it too
                    if (state.EquippedBagIdHashes.Contains(bagId))
                        continue;

                    BuildSellRow(bagId, item, y, shown);
                    y -= RowHeight + RowGap;
                    shown++;
                }
            }

            if (shown == 0)
            {
                BuildNote("ไม่มีของในกระเป๋า", y);
                y -= RowHeight;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        private void BuildSellRow(int bagId, InventoryItem item, float y, int index)
        {
            var row = NewRow(y, index);

            var sprite = ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetIconAtlasSprite(item.ItemData.Code)
                : null;
            if (sprite != null)
            {
                var size = RowHeight - 14f;
                var icon = ModernUiTheme.CreateIcon(row, sprite, Color.white, size);
                ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f),
                    new Vector2(IconInset, 0f), new Vector2(size, size));
            }

            var label = item.Count > 1 ? $"{item.ProperName()}  x{item.Count}" : item.ProperName();
            var name = ModernUiTheme.CreateText(row, "Name", label,
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.Left);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(TextInset, 0f), new Vector2(PlainWidth, RowHeight));

            var pick = ModernUiTheme.CreateButton(row, "Pick", "เลือก",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)pick.transform, new Vector2(1, 0.5f),
                new Vector2(-8f, 0f), new Vector2(ActionWidth, RowHeight - 10f));

            var id = bagId;
            var count = item.Count;
            var itemName = item.ProperName();
            pick.onClick.AddListener(() => AskForPrice(id, count, itemName));
        }

        /// <summary>
        /// Asks how much of it and for how much, then hands over to the duration page.
        ///
        /// A stack of one has nothing to ask about, so it skips straight to the price -
        /// a prompt whose only valid answer is 1 is a prompt worth not showing.
        /// </summary>
        private void AskForPrice(int bagId, int available, string itemName)
        {
            if (available <= 1)
            {
                PromptPrice(bagId, 1, itemName);
                return;
            }

            UiManager.Instance.TextInputWindow.BeginTextInput(
                $"ตั้งขาย {itemName} กี่ชิ้น (มี {available})", text =>
                {
                    if (!int.TryParse(text, out var wanted) || wanted <= 0)
                    {
                        CameraFollower.Instance.AppendError("ใส่เป็นตัวเลขเท่านั้น");
                        return;
                    }

                    if (wanted > available)
                        wanted = available;

                    PromptPrice(bagId, wanted, itemName);
                });
        }

        private void PromptPrice(int bagId, int count, string itemName)
        {
            UiManager.Instance.TextInputWindow.BeginTextInput(
                $"ราคาเริ่มต้นของ {itemName} (Zeny)", text =>
                {
                    if (!int.TryParse(text, out var price) || price < 10)
                    {
                        CameraFollower.Instance.AppendError("ราคาต้องเป็นตัวเลข ไม่ต่ำกว่า 10 Zeny");
                        return;
                    }

                    pendingBagId = bagId;
                    pendingCount = count;
                    pendingPrice = price;
                    pendingName = itemName;
                    selling = SellStage.PickingDuration;
                    Redraw();
                });
        }

        private void DrawDurationPicker()
        {
            var back = ModernUiTheme.CreateButton(toolRow, "Back", "ย้อนกลับ",
                ModernUiTheme.CardDeepColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)back.transform, new Vector2(0, 0.5f),
                new Vector2(0f, 0f), new Vector2(90f, ToolRowHeight - 2f));
            back.onClick.AddListener(() =>
            {
                selling = SellStage.PickingItem;
                Redraw();
            });

            //The fee is shown before it is charged rather than after, because it comes out
            //whether or not the thing ever sells.
            var fee = pendingPrice / 100;
            if (fee < 10)
                fee = 10;

            subtitle.text = "เลือกระยะเวลา";
            BuildHeading($"{pendingName} x{pendingCount}  ·  เริ่ม {pendingPrice:N0} Zeny  ·  ค่าฝาก {fee:N0} Zeny",
                -RowGap);

            var y = -RowGap - HeadingHeight - RowGap;
            var index = 0;
            foreach (var hours in DurationChoices)
            {
                var row = NewRow(y, index++);
                var pick = ModernUiTheme.CreateButton(row, "Hours" + hours, $"{hours} ชั่วโมง",
                    ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeLabel);
                ModernUiTheme.Stretch((RectTransform)pick.transform, 8f, 3f, -8f, -3f);

                var chosen = hours;
                pick.onClick.AddListener(() =>
                {
                    NetworkManager.Instance.SendAuctionCreate(pendingBagId, pendingCount,
                        pendingPrice, chosen);
                    selling = SellStage.NotSelling;
                    Redraw();
                });

                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        // =====================================================================
        // The parcel box

        private void DrawParcels()
        {
            subtitle.text = MarketState.ParcelsWaiting > 0
                ? $"มี {MarketState.ParcelsWaiting} ชิ้นรอรับ"
                : "ว่าง";

            if (MarketState.Parcels.Count > 0)
            {
                var all = ModernUiTheme.CreateButton(toolRow, "ClaimAll", "รับทั้งหมด",
                    ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)all.transform, new Vector2(0, 0.5f),
                    new Vector2(0f, 0f), new Vector2(110f, ToolRowHeight - 2f));
                all.onClick.AddListener(() =>
                    NetworkManager.Instance.SendInboxAction(InboxRequestType.ClaimAll));
            }

            var y = -RowGap;
            if (!MarketState.ParcelsReceived)
            {
                DrawWaiting();
                return;
            }

            if (MarketState.Parcels.Count == 0)
            {
                BuildNote("ไม่มีของรอรับ", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            var index = 0;
            foreach (var parcel in MarketState.Parcels)
            {
                BuildParcelRow(parcel, y, index++);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        private void BuildParcelRow(ParcelEntry parcel, float y, int index)
        {
            var row = NewRow(y, index);
            var data = !parcel.IsMoneyOnly && ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetItemById(parcel.Item.ItemId)
                : null;

            RowIcon(row, data);

            //Money with no item behind it still gets something to look at, otherwise the
            //rows that are pure payout are the ones with a hole where the picture goes.
            if (parcel.IsMoneyOnly)
            {
                var coin = ModernUiTheme.CreateIcon(row, ModernUiIcons.Coin, MoneyColor,
                    RowHeight - 16f);
                ModernUiTheme.Place(coin.rectTransform, new Vector2(0, 0.5f),
                    new Vector2(IconInset + 1f, 0f),
                    new Vector2(RowHeight - 16f, RowHeight - 16f));
            }

            var what = parcel.IsMoneyOnly
                ? $"{parcel.Zeny:N0} Zeny"
                : ItemLabel(parcel.Item, data) + (parcel.Zeny > 0 ? $"  +{parcel.Zeny:N0} Zeny" : "");

            var name = ModernUiTheme.CreateText(row, "What", what,
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -5f), new Vector2(PlainWidth, 18f));

            var why = ReasonText(parcel.Reason);
            if (!string.IsNullOrEmpty(parcel.FromName))
                why += $"  ·  {parcel.FromName}";

            var under = ModernUiTheme.CreateText(row, "Why", why,
                ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
            under.textWrappingMode = TextWrappingModes.NoWrap;
            under.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(under.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -21f), new Vector2(PlainWidth, 16f));

            var id = parcel.Id;
            var take = ModernUiTheme.CreateButton(row, "Take", "รับ",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)take.transform, new Vector2(1, 0.5f),
                new Vector2(-8f, 0f), new Vector2(ActionWidth, RowHeight - 10f));
            take.onClick.AddListener(() =>
                NetworkManager.Instance.SendInboxAction(InboxRequestType.Claim, id));
        }

        // =====================================================================
        // Wording and small pieces

        private static string ReasonText(ParcelReason reason)
        {
            switch (reason)
            {
                case ParcelReason.AuctionSold: return "ของที่ตั้งประมูลขายได้แล้ว";
                case ParcelReason.AuctionExpired: return "หมดเวลา ไม่มีคนบิด";
                case ParcelReason.AuctionWon: return "ชนะการประมูล";
                case ParcelReason.AuctionOutbid: return "มีคนบิดสูงกว่า คืนเงิน";
                case ParcelReason.AuctionCancelled: return "ยกเลิกรายการ";
                case ParcelReason.BuyOrderFilled: return "คำสั่งซื้อสำเร็จ";
                case ParcelReason.BuyOrderClosed: return "ปิดคำสั่งซื้อ";
                case ParcelReason.BuyOrderSold: return "ขายเข้าคำสั่งซื้อ";
                default: return "";
            }
        }

        /// <summary>
        /// The name with what makes this one different from another of the same thing.
        ///
        /// A refine and a card are the whole reason one sword is worth more than the next,
        /// so leaving them off the row would make two very different listings read alike.
        /// </summary>
        private static string ItemLabel(MarketItemView item, RebuildSharedData.ClientTypes.ItemData data)
        {
            var name = data != null ? data.Name : $"#{item.ItemId}";
            if (item.Refine > 0)
                name = $"+{item.Refine} {name}";

            if (item.Count > 1)
                name += $"  x{item.Count}";

            if (!item.IsUnique)
                return name;

            var cards = 0;
            for (var i = 0; i < 4; i++)
                if (item.Slots[i] > 0)
                    cards++;

            return cards > 0 ? $"{name}  [{cards} การ์ด]" : name;
        }

        /// <summary>How long is left, counted down from when the server said it.</summary>
        private int SecondsLeft(AuctionEntry entry) =>
            entry.SecondsLeft - (int)(Time.realtimeSinceStartup - listingStamp);

        /// <summary>How long ago something happened, as words.</summary>
        private static string TimeAgoText(int seconds)
        {
            if (seconds < 60)
                return "เมื่อสักครู่";
            if (seconds < 3600)
                return $"{seconds / 60} นาทีที่แล้ว";
            if (seconds < 86400)
                return $"{seconds / 3600} ชั่วโมงที่แล้ว";
            return $"{seconds / 86400} วันที่แล้ว";
        }

        /// <summary>Whether a name on a row is this character's own.</summary>
        private static bool IsMe(string name)
        {
            var state = PlayerState.Instance;
            return state != null && !string.IsNullOrEmpty(name)
                   && string.Equals(state.PlayerName, name, StringComparison.Ordinal);
        }

        /// <summary>A length of time as words, coarsening as it gets longer.</summary>
        private static string TimeLeftText(int left)
        {
            if (left <= 0)
                return "หมดเวลาแล้ว";
            if (left < 60)
                return $"เหลือ {left} วินาที";
            if (left < 3600)
                return $"เหลือ {left / 60} นาที";
            if (left < 86400)
                return $"เหลือ {left / 3600} ชั่วโมง";
            return $"เหลือ {left / 86400} วัน";
        }

        /// <summary>
        /// Asks before doing something that takes money and cannot be undone for free.
        ///
        /// Posting an order is the case that needs it: the whole total leaves the purse
        /// immediately, which is not what anybody expects from a thing called an offer.
        /// </summary>
        private static void Confirm(string question, Action onYes)
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.YesNoOptionsWindow == null)
            {
                Debug.LogError("[MarketWindow] No confirmation window, so nothing was done.");
                return;
            }

            ui.YesNoOptionsWindow.BeginPrompt(question, "ตกลง", "ยกเลิก", onYes, null, false);
        }

        /// <summary>The item's own icon at the left of a row, when the client has one.</summary>
        private static void RowIcon(RectTransform row, RebuildSharedData.ClientTypes.ItemData data)
        {
            if (data == null || ClientDataLoader.Instance == null)
                return;

            var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(data.Code);
            if (sprite == null)
                return;

            var size = RowHeight - 14f;
            var icon = ModernUiTheme.CreateIcon(row, sprite, Color.white, size);
            ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f),
                new Vector2(IconInset, 0f), new Vector2(size, size));
        }

        /// <summary>
        /// A coloured bar down the left of a row that has something to do with you.
        ///
        /// Cheaper to read than a word would be: on a page of forty rows the only question
        /// being asked is "which of these are mine", and a bar answers it without being
        /// read at all.
        /// </summary>
        private static void Stripe(RectTransform row, Color color)
        {
            var bar = ModernUiTheme.CreateCard(row, "Stripe", color);
            ModernUiTheme.Place(bar, new Vector2(0, 0.5f), new Vector2(3f, 0f),
                new Vector2(StripeWidth, RowHeight - 12f));
            bar.GetComponent<Image>().raycastTarget = false;
        }

        /// <summary>
        /// The price and the countdown, right aligned in a column of their own.
        ///
        /// Given a column rather than a place at the end of a sentence because the price is
        /// what every one of these rows is actually about, and reading it off the end of a
        /// line of words means reading the words first.
        /// </summary>
        private static void MoneyColumn(RectTransform row, string money, string when,
            Color whenColor, float rightInset = ActionWidth + 16f)
        {
            var price = ModernUiTheme.CreateText(row, "Money", money, ModernUiTheme.SizeLabel,
                MoneyColor, TextAlignmentOptions.TopRight, FontStyles.Bold);
            price.textWrappingMode = TextWrappingModes.NoWrap;
            price.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(price.rectTransform, new Vector2(1, 1),
                new Vector2(-rightInset, -5f), new Vector2(MoneyWidth, 18f));

            var time = ModernUiTheme.CreateText(row, "When", when, ModernUiTheme.SizeSmall,
                whenColor, TextAlignmentOptions.TopRight);
            time.textWrappingMode = TextWrappingModes.NoWrap;
            time.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(time.rectTransform, new Vector2(1, 1),
                new Vector2(-rightInset, -21f), new Vector2(MoneyWidth, 16f));
        }

        /// <summary>
        /// Makes a whole row open something, without taking the drag that scrolls the list.
        ///
        /// A Button answers a click and implements none of the drag handlers, so a finger
        /// moving across a row goes past it to the ScrollRect above. Its own buttons are
        /// drawn over it and so are hit first, which is what makes a tap on the right of a
        /// row act on it and a tap anywhere else look at it.
        /// </summary>
        private static void MakeRowClickable(RectTransform row, Action onClick)
        {
            var image = row.GetComponent<Image>();
            image.raycastTarget = true;

            var button = row.gameObject.AddComponent<Button>();
            button.targetGraphic = image;

            //Nothing to arrow between: the rows are rebuilt on every refresh, and a
            //keyboard walking a list that keeps being destroyed lands on nothing.
            button.navigation = new Navigation { mode = Navigation.Mode.None };

            //multiplied against the row's own colour, so white means leave it alone
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(0.94f, 0.97f, 1f);
            colors.pressedColor = new Color(0.86f, 0.91f, 0.98f);
            colors.selectedColor = Color.white;
            colors.disabledColor = Color.white;
            colors.fadeDuration = 0.08f;
            button.colors = colors;

            button.onClick.AddListener(() => onClick());
        }

        /// <summary>
        /// One full width row at the given offset down the list.
        ///
        /// Stretched between the left and right edges and given a negative width, which is
        /// how a rect anchored to both sides is inset - setting offsets after an
        /// anchoredPosition mixes two ways of saying the same thing and one of them wins.
        ///
        /// Every other one is a shade lighter. Forty rows of one colour read as a single
        /// block of text and the eye loses its place halfway across a line; the banding is
        /// what keeps a price on the right attached to the name on the left.
        /// </summary>
        private RectTransform NewRow(float y, int index = 0)
        {
            var row = ModernUiTheme.CreateCard(body, "Row",
                (index & 1) == 0 ? ModernUiTheme.CardColor : RowAltColor);
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
            var heading = ModernUiTheme.CreateText(body, "Heading", text, ModernUiTheme.SizeSmall,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            heading.textWrappingMode = TextWrappingModes.NoWrap;
            heading.overflowMode = TextOverflowModes.Ellipsis;

            var rect = heading.rectTransform;
            rect.anchorMin = new Vector2(0, 1);
            rect.anchorMax = new Vector2(1, 1);
            rect.pivot = new Vector2(0.5f, 1);
            rect.sizeDelta = new Vector2(-24f, HeadingHeight);
            rect.anchoredPosition = new Vector2(0, y);
            rows.Add(heading.gameObject);
        }

        private void BuildNote(string text, float y)
        {
            var note = ModernUiTheme.CreateText(body, "Note", text, ModernUiTheme.SizeLabel,
                ModernUiTheme.MutedColor, TextAlignmentOptions.Center);

            var rect = note.rectTransform;
            rect.anchorMin = new Vector2(0, 1);
            rect.anchorMax = new Vector2(1, 1);
            rect.pivot = new Vector2(0.5f, 1);
            rect.sizeDelta = new Vector2(-24f, RowHeight);
            rect.anchoredPosition = new Vector2(0, y);
            rows.Add(note.gameObject);
        }
    }
}
