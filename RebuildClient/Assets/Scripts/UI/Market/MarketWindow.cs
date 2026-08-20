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
        private const float Width = 560f;
        private const float Height = 470f;
        private const float Pad = 8f;

        private const float TabHeight = 30f;
        private const float TabGap = 4f;
        private const float ToolRowHeight = 28f;
        private const float RowHeight = 34f;
        private const float RowGap = 3f;
        private const float HeadingHeight = 22f;

        /// <summary>Where the list starts, under the title bar, the tabs and the tool row.</summary>
        private const float BodyTop = ModernUiTheme.TitleBarHeight + TabHeight + TabGap
                                      + ToolRowHeight + TabGap;

        /// <summary>The server's own choices, kept here so the buttons can offer exactly them.</summary>
        private static readonly int[] DurationChoices = { 8, 24, 48 };

        /// <summary>Asked for again on this cadence while a page that goes stale is open.</summary>
        private const float RefreshInterval = 10f;

        private enum Page
        {
            Browse,
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

        private int drawnRevision = -1;
        private float refreshTimer;

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
                new Vector2(-52f, -30f), new Vector2(220f, 20f));

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
            var labels = new[] { "ประมูล", "ของฉัน", "กล่องพัสดุ" };
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

            switch (page)
            {
                case Page.Browse:
                    net.SendAuctionBrowse(MarketState.BrowseSearch, MarketState.BrowsePage);
                    break;
                case Page.Mine:
                    net.SendAuctionAction(AuctionRequestType.Mine);
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

            switch (page)
            {
                case Page.Browse:
                    DrawBrowse();
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
                BuildNote("กำลังโหลด...", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            if (MarketState.Listings.Count == 0)
            {
                BuildNote(string.IsNullOrEmpty(MarketState.BrowseSearch)
                    ? "ยังไม่มีใครตั้งประมูล"
                    : "ไม่พบของที่ค้นหา", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            foreach (var entry in MarketState.Listings)
            {
                BuildListingRow(entry, y, false);
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

            subtitle.text = $"ทั้งหมด {MarketState.BrowseTotal:N0} รายการ  ·  หน้า {MarketState.BrowsePage + 1}/{pages}";

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
            var sell = ModernUiTheme.CreateButton(toolRow, "Sell", "ตั้งประมูล",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)sell.transform, new Vector2(0, 0.5f),
                new Vector2(0f, 0f), new Vector2(110f, ToolRowHeight - 2f));
            sell.onClick.AddListener(() =>
            {
                selling = SellStage.PickingItem;
                Redraw();
            });

            subtitle.text = $"ตั้งได้ไม่เกิน 10 รายการ  ·  ค่าฝาก 1%  ·  ขายได้หัก 3%";

            var y = -RowGap;
            if (!MarketState.MineReceived)
            {
                BuildNote("กำลังโหลด...", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            if (MarketState.Mine.Count == 0)
            {
                BuildNote("ยังไม่ได้ตั้งประมูล และยังไม่ได้บิดอะไร", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            foreach (var entry in MarketState.Mine)
            {
                BuildListingRow(entry, y, true);
                y -= RowHeight + RowGap;
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
        /// </summary>
        private void BuildListingRow(AuctionEntry entry, float y, bool ownPage)
        {
            var row = NewRow(y);
            var data = ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetItemById(entry.Item.ItemId)
                : null;

            if (data != null && ClientDataLoader.Instance != null)
            {
                var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(data.Code);
                if (sprite != null)
                {
                    var icon = ModernUiTheme.CreateIcon(row, sprite, Color.white, RowHeight - 10f);
                    ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f),
                        new Vector2(6f, 0f), new Vector2(RowHeight - 10f, RowHeight - 10f));
                }
            }

            var name = ModernUiTheme.CreateText(row, "Name", ItemLabel(entry.Item, data),
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                new Vector2(RowHeight, -3f), new Vector2(Width - RowHeight - 200f, 18f));

            var price = entry.HighBid > 0
                ? $"บิดสูงสุด {entry.HighBid:N0} Zeny โดย {entry.HighBidderName}"
                : $"ราคาเริ่ม {entry.StartPrice:N0} Zeny · ยังไม่มีคนบิด";
            var under = ModernUiTheme.CreateText(row, "Price", $"{price}  ·  {TimeLeft(entry)}",
                ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
            under.textWrappingMode = TextWrappingModes.NoWrap;
            under.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(under.rectTransform, new Vector2(0, 1),
                new Vector2(RowHeight, -18f), new Vector2(Width - RowHeight - 130f, 16f));

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
                    new Vector2(-8f, 0f), new Vector2(74f, RowHeight - 8f));
                cancel.onClick.AddListener(() =>
                    NetworkManager.Instance.SendAuctionAction(AuctionRequestType.Cancel, id));
                return;
            }

            var bid = ModernUiTheme.CreateButton(row, "Bid", "บิด",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)bid.transform, new Vector2(1, 0.5f),
                new Vector2(-8f, 0f), new Vector2(74f, RowHeight - 8f));

            var captured = entry;
            bid.onClick.AddListener(() => AskForBid(captured));
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

                    BuildSellRow(bagId, item, y);
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

        private void BuildSellRow(int bagId, InventoryItem item, float y)
        {
            var row = NewRow(y);

            var sprite = ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetIconAtlasSprite(item.ItemData.Code)
                : null;
            if (sprite != null)
            {
                var icon = ModernUiTheme.CreateIcon(row, sprite, Color.white, RowHeight - 10f);
                ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f),
                    new Vector2(6f, 0f), new Vector2(RowHeight - 10f, RowHeight - 10f));
            }

            var label = item.Count > 1 ? $"{item.ProperName()}  x{item.Count}" : item.ProperName();
            var name = ModernUiTheme.CreateText(row, "Name", label,
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.Left);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 0.5f),
                new Vector2(RowHeight, 0f), new Vector2(Width - RowHeight - 130f, RowHeight));

            var pick = ModernUiTheme.CreateButton(row, "Pick", "เลือก",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)pick.transform, new Vector2(1, 0.5f),
                new Vector2(-8f, 0f), new Vector2(74f, RowHeight - 8f));

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
            foreach (var hours in DurationChoices)
            {
                var row = NewRow(y);
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
                BuildNote("กำลังโหลด...", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            if (MarketState.Parcels.Count == 0)
            {
                BuildNote("ไม่มีของรอรับ", y);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            foreach (var parcel in MarketState.Parcels)
            {
                BuildParcelRow(parcel, y);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        private void BuildParcelRow(ParcelEntry parcel, float y)
        {
            var row = NewRow(y);
            var data = !parcel.IsMoneyOnly && ClientDataLoader.Instance != null
                ? ClientDataLoader.Instance.GetItemById(parcel.Item.ItemId)
                : null;

            if (data != null && ClientDataLoader.Instance != null)
            {
                var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(data.Code);
                if (sprite != null)
                {
                    var icon = ModernUiTheme.CreateIcon(row, sprite, Color.white, RowHeight - 10f);
                    ModernUiTheme.Place(icon.rectTransform, new Vector2(0, 0.5f),
                        new Vector2(6f, 0f), new Vector2(RowHeight - 10f, RowHeight - 10f));
                }
            }

            var what = parcel.IsMoneyOnly
                ? $"{parcel.Zeny:N0} Zeny"
                : ItemLabel(parcel.Item, data) + (parcel.Zeny > 0 ? $"  +{parcel.Zeny:N0} Zeny" : "");

            var name = ModernUiTheme.CreateText(row, "What", what,
                ModernUiTheme.SizeLabel, ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                new Vector2(RowHeight, -3f), new Vector2(Width - RowHeight - 130f, 18f));

            var why = ReasonText(parcel.Reason);
            if (!string.IsNullOrEmpty(parcel.FromName))
                why += $"  ·  {parcel.FromName}";

            var under = ModernUiTheme.CreateText(row, "Why", why,
                ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
            under.textWrappingMode = TextWrappingModes.NoWrap;
            under.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(under.rectTransform, new Vector2(0, 1),
                new Vector2(RowHeight, -18f), new Vector2(Width - RowHeight - 130f, 16f));

            var id = parcel.Id;
            var take = ModernUiTheme.CreateButton(row, "Take", "รับ",
                ModernUiTheme.AccentColor, ModernUiTheme.LightInkColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)take.transform, new Vector2(1, 0.5f),
                new Vector2(-8f, 0f), new Vector2(66f, RowHeight - 8f));
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
        private string TimeLeft(AuctionEntry entry)
        {
            var left = entry.SecondsLeft - (int)(Time.realtimeSinceStartup - listingStamp);
            if (left <= 0)
                return "หมดเวลาแล้ว";
            if (left < 60)
                return $"เหลือ {left} วินาที";
            if (left < 3600)
                return $"เหลือ {left / 60} นาที";
            return $"เหลือ {left / 3600} ชั่วโมง";
        }

        /// <summary>
        /// One full width row at the given offset down the list.
        ///
        /// Stretched between the left and right edges and given a negative width, which is
        /// how a rect anchored to both sides is inset - setting offsets after an
        /// anchoredPosition mixes two ways of saying the same thing and one of them wins.
        /// </summary>
        private RectTransform NewRow(float y)
        {
            var row = ModernUiTheme.CreateCard(body, "Row", ModernUiTheme.CardColor);
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
