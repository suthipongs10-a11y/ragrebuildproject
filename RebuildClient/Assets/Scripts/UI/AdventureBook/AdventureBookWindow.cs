using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.Sprites;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.AdventureBook
{
    /// <summary>
    /// The adventure book: what has been hunted, what it pays, and somewhere to go next.
    ///
    /// Three depths in one window rather than three windows - the regions, the pages of one
    /// region, and one page - because on a phone a second floating window is a window covering
    /// the one being read, and the three are one errand: pick a place, pick a thing, go there.
    ///
    /// Rewards are drawn with their own icon and name at every depth. A row saying a region
    /// pays "Detective's_Cap" is a row nobody reads; a hat with a picture of a hat next to it
    /// is the reason somebody spends a week in the culverts. Stars are drawn as the theme's
    /// star sprite rather than as text, because the interface font has no star in it and drew
    /// an empty box for every one.
    ///
    /// Nothing here decides anything. Every number came off the wire and every button sends a
    /// request; the server owns the book and the right to travel, and this draws its answers.
    /// <see cref="AdventureBookState.Revision"/> is how it notices they changed - the number
    /// last drawn is kept and the page rebuilt when it no longer matches, which avoids an
    /// event holding a reference to a destroyed window.
    ///
    /// Laid out by hand for the same reason the market is: the lists are of unknown length,
    /// and a layout group with a size fitter leaves the rect it drives at zero height until a
    /// layout pass has run on an active object.
    /// </summary>
    public class AdventureBookWindow : WindowBase
    {
        private const float Width = 600f;
        private const float Height = 500f;
        private const float Pad = 8f;

        private const float HeaderHeight = 28f;
        private const float RowHeight = 44f;
        private const float TallRowHeight = 56f;
        private const float RowGap = 5f;
        private const float BodyTop = ModernUiTheme.TitleBarHeight + HeaderHeight + Pad;

        /// <summary>Inside the scroll tray, once the tray's own margins are taken off.</summary>
        private const float RowWidth = Width - Pad * 4f;

        private const float StarSize = 18f;
        private const float RewardIconSize = 30f;
        private const float GoWidth = 116f;

        /// <summary>A star that has been earned, against one that has not.</summary>
        private static readonly Color EarnedColor = new Color(0.918f, 0.694f, 0.145f);
        private static readonly Color UnearnedColor = new Color(0.741f, 0.780f, 0.827f);

        private static readonly Color RowAltColor = new Color(0.945f, 0.961f, 0.980f);
        private static readonly Color DoneColor = new Color(0.106f, 0.412f, 0.208f);
        private static readonly Color TrackColor = new Color(0.816f, 0.859f, 0.910f);
        private static readonly Color FillColor = new Color(0.235f, 0.545f, 0.851f);

        private enum View { Regions, Pages, Page }

        private static AdventureBookWindow instance;

        private RectTransform body;
        private TextMeshProUGUI header;
        private View view = View.Regions;
        private int regionIndex = -1;
        private int pageId = -1;
        private int drawnRevision = -1;

        private readonly List<GameObject> rows = new List<GameObject>();

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

            //Opened on the region list rather than wherever it was last, because a page read
            //an hour ago is rarely the page somebody came back for.
            instance.view = View.Regions;
            instance.regionIndex = -1;
            instance.pageId = -1;

            NetworkManager.Instance.SendAdventureBookRefresh();
            instance.Redraw();
        }

        private static AdventureBookWindow Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            //assembled inactive so nothing runs against a half built window
            var host = new GameObject("AdventureBookWindow", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<AdventureBookWindow>();
            window.CanCloseWithEscape = true;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, "สมุดผจญภัย", "", ModernUiIcons.Book);
            ModernUiTheme.AttachShadow(rect);

            window.header = ModernUiTheme.CreateText(rect, "Header", "", ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            window.header.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(window.header.rectTransform, new Vector2(0, 1),
                new Vector2(Pad + 2f, -ModernUiTheme.TitleBarHeight),
                new Vector2(Width - Pad * 2f, HeaderHeight));

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

        private void Update()
        {
            if (drawnRevision != AdventureBookState.Revision)
                Redraw();
        }

        // =====================================================================
        // Drawing

        private void Redraw()
        {
            drawnRevision = AdventureBookState.Revision;

            foreach (var row in rows)
                if (row != null)
                    Destroy(row);
            rows.Clear();

            if (!AdventureBookState.Received)
            {
                header.text = "กำลังโหลด...";
                return;
            }

            var next = AdventureBookState.StarsForNextRank;
            var toNext = next > 0
                ? $"   อีก {next - AdventureBookState.Stars:N0} ดาวถึงระดับ {AdventureBookState.Rank + 1}"
                : "   ระดับสูงสุด";
            header.text = $"Adventure ระดับ {AdventureBookState.Rank}   ·   {AdventureBookState.Stars:N0} / {AdventureBookState.StarTotal:N0} ดาว{toNext}";

            var y = Pad;
            switch (view)
            {
                case View.Regions: y = DrawRegions(); break;
                case View.Pages: y = DrawPages(); break;
                case View.Page: y = DrawPage(); break;
            }

            body.sizeDelta = new Vector2(0, y);
        }

        private float DrawRegions()
        {
            var y = Pad;
            for (var i = 0; i < AdventureBookState.Regions.Count; i++)
            {
                var region = AdventureBookState.Regions[i];
                var done = 0;
                foreach (var page in region.Pages)
                    if (page.IsComplete)
                        done++;

                var index = i;
                var card = NewCard(y, TallRowHeight,
                    () => { view = View.Pages; regionIndex = index; Redraw(); });

                //The hat first: it is why somebody picks one region over another.
                var hasIcon = DrawItemIcon(card, region.RewardItemId, new Vector2(10f, -(TallRowHeight - RewardIconSize) / 2f));
                var textLeft = hasIcon ? 10f + RewardIconSize + 10f : 12f;

                Label(card, region.Name, textLeft, -8f, 300f, ModernUiTheme.SizeBody,
                    region.Complete ? DoneColor : ModernUiTheme.NameColor);
                Label(card, "รางวัล: " + ItemName(region.RewardItemId), textLeft, -30f, 300f,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);

                Value(card, region.Complete ? "ครบแล้ว" : $"{done}/{region.Pages.Count} หน้า",
                    -12f, -(TallRowHeight - 20f) / 2f, 150f,
                    region.Complete ? DoneColor : ModernUiTheme.MutedColor);

                y += TallRowHeight + RowGap;
            }

            return y + Pad;
        }

        private float DrawPages()
        {
            var y = Pad;
            if (regionIndex < 0 || regionIndex >= AdventureBookState.Regions.Count)
            {
                view = View.Regions;
                return DrawRegions();
            }

            var region = AdventureBookState.Regions[regionIndex];
            y = BackRow(y, region.Name, () => { view = View.Regions; Redraw(); });

            foreach (var page in region.Pages)
            {
                var id = page.PageId;
                var target = page.HasHunt ? page.HuntTargetLarge : page.HuntTarget;
                var card = NewCard(y, RowHeight, () => { view = View.Page; pageId = id; Redraw(); });

                Label(card, page.Name, 12f, -(RowHeight - 20f) / 2f, 230f, ModernUiTheme.SizeBody,
                    page.IsComplete ? DoneColor : ModernUiTheme.NameColor);

                DrawStars(card, page, 250f);

                Value(card, page.IsComplete ? "ครบแล้ว" : $"{page.Kills:N0}/{target:N0}",
                    -12f, -(RowHeight - 20f) / 2f, 140f,
                    page.IsComplete ? DoneColor : ModernUiTheme.MutedColor);

                y += RowHeight + RowGap;
            }

            return y + Pad;
        }

        private float DrawPage()
        {
            var y = Pad;
            if (!AdventureBookState.PagesById.TryGetValue(pageId, out var page))
            {
                view = View.Pages;
                return DrawPages();
            }

            y = BackRow(y, $"{page.Name}   Lv {page.Level}", () => { view = View.Pages; Redraw(); });

            //Only where it is news. A page covering one monster is named after it, so saying
            //so again would be a row that tells nobody anything.
            if (!string.IsNullOrEmpty(page.Members))
            {
                var note = NewCard(y, RowHeight, null);
                Label(note, "นับรวม", 12f, -(RowHeight - 20f) / 2f, 90f, ModernUiTheme.SizeLabel, ModernUiTheme.LabelColor);
                Label(note, page.Members, 104f, -(RowHeight - 20f) / 2f, RowWidth - 120f,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);
                y += RowHeight + RowGap;
            }

            y = StarRow(y, page, 0, "ดาว 1", page.HasHunt, page.Kills, page.HuntTarget);
            y = StarRow(y, page, 1, "ดาว 2", page.HasHuntLarge, page.Kills, page.HuntTargetLarge);

            if (page.CardItemId > 0)
                y = StarRow(y, page, 2, "ดาว 3", page.HasCard, 0, 0);
            else
            {
                var none = NewCard(y, RowHeight, null);
                Label(none, "ไม่ดรอปการ์ด หน้านี้จบที่ 2 ดาว", 12f, -(RowHeight - 20f) / 2f,
                    RowWidth - 24f, ModernUiTheme.SizeLabel, ModernUiTheme.MutedColor);
                y += RowHeight + RowGap;
            }

            if (page.Sightings == null || page.Sightings.Count == 0)
                return y + Pad;

            var heading = NewCard(y, RowHeight, null);
            Label(heading, "เจอที่แมพ", 12f, -(RowHeight - 20f) / 2f, 200f, ModernUiTheme.SizeLabel, ModernUiTheme.LabelColor);
            if (!page.HasHunt)
                Value(heading, "ต้องได้ดาว 1 ก่อนถึงวาร์ปได้", -12f, -(RowHeight - 20f) / 2f, 280f, ModernUiTheme.MutedColor);
            y += RowHeight + RowGap;

            foreach (var sighting in page.Sightings)
            {
                var map = sighting.Map;
                var id = page.PageId;
                var card = NewCard(y, RowHeight, null);

                Label(card, map, 12f, -(RowHeight - 20f) / 2f, 200f, ModernUiTheme.SizeBody, ModernUiTheme.NameColor);
                Value(card, $"{sighting.Count:N0} ตัว", -(GoWidth + 20f), -(RowHeight - 20f) / 2f, 120f, ModernUiTheme.MutedColor);

                if (page.HasHunt)
                {
                    var go = ModernUiTheme.CreateButton(card, "Go", "วาร์ปไปที่แมพ",
                        ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeLabel);
                    ModernUiTheme.Place((RectTransform)go.transform, new Vector2(1, 1),
                        new Vector2(-8f, -(RowHeight - 28f) / 2f), new Vector2(GoWidth, 28f));
                    go.onClick.AddListener(() => NetworkManager.Instance.SendAdventureBookWarp(id, map));
                }

                y += RowHeight + RowGap;
            }

            return y + Pad;
        }

        // =====================================================================
        // Pieces

        /// <summary>One star row on a page: the star, what it asks for, and what it pays.</summary>
        private float StarRow(float y, AdventureBookPage page, int starIndex, string label,
            bool earned, int kills, int target)
        {
            var card = NewCard(y, TallRowHeight, null);

            var star = ModernUiTheme.CreateIcon(card, ModernUiIcons.Star, earned ? EarnedColor : UnearnedColor, StarSize);
            ModernUiTheme.Place((RectTransform)star.transform, new Vector2(0, 1),
                new Vector2(12f, -(TallRowHeight - StarSize) / 2f), new Vector2(StarSize, StarSize));

            Label(card, earned ? label + "   สำเร็จ" : label, 12f + StarSize + 10f, -8f, 200f,
                ModernUiTheme.SizeBody, earned ? DoneColor : ModernUiTheme.NameColor);

            if (target > 0)
            {
                var shown = Mathf.Min(kills, target);
                Label(card, $"{shown:N0}/{target:N0}", 12f + StarSize + 10f, -30f, 200f,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);
                DrawBar(card, 12f + StarSize + 10f + 92f, -34f, 150f, target <= 0 ? 0f : (float)shown / target);
            }
            else if (!earned)
            {
                Label(card, "ต้องมีการ์ดของมอนตัวนี้", 12f + StarSize + 10f, -30f, 260f,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);
            }

            DrawReward(card, AdventureBookState.RewardFor(page.Level, starIndex));

            return y + TallRowHeight + RowGap;
        }

        /// <summary>The reward chip on the right of a row: the icon, then what it is.</summary>
        private void DrawReward(RectTransform card, AdventureBookReward reward)
        {
            if (!reward.HasItem)
                return;

            var iconLeft = RowWidth - 12f - 190f;
            DrawItemIcon(card, reward.ItemId, new Vector2(iconLeft, -(TallRowHeight - RewardIconSize) / 2f));

            var name = ItemName(reward.ItemId);
            if (reward.Count > 1)
                name += $" x{reward.Count}";

            Label(card, name, iconLeft + RewardIconSize + 8f, -(TallRowHeight - 20f) / 2f, 150f,
                ModernUiTheme.SizeSmall, ModernUiTheme.NameColor);
        }

        private void DrawStars(RectTransform card, AdventureBookPage page, float left)
        {
            var earned = page.StarCount;
            for (var i = 0; i < page.MaxStars; i++)
            {
                var star = ModernUiTheme.CreateIcon(card, ModernUiIcons.Star,
                    i < earned ? EarnedColor : UnearnedColor, StarSize);
                ModernUiTheme.Place((RectTransform)star.transform, new Vector2(0, 1),
                    new Vector2(left + i * (StarSize + 4f), -(RowHeight - StarSize) / 2f),
                    new Vector2(StarSize, StarSize));
            }
        }

        private void DrawBar(RectTransform card, float left, float top, float width, float fraction)
        {
            var track = ModernUiTheme.CreateCard(card, "Track", TrackColor);
            ModernUiTheme.Place(track, new Vector2(0, 1), new Vector2(left, top), new Vector2(width, 6f));
            track.GetComponent<Image>().raycastTarget = false;

            fraction = Mathf.Clamp01(fraction);
            if (fraction <= 0f)
                return;

            var fill = ModernUiTheme.CreateCard(track, "Fill", FillColor);
            ModernUiTheme.Place(fill, new Vector2(0, 1), new Vector2(0f, 0f), new Vector2(width * fraction, 6f));
            fill.GetComponent<Image>().raycastTarget = false;
        }

        private float BackRow(float y, string title, System.Action onBack)
        {
            var card = NewCard(y, RowHeight, onBack);
            Label(card, "< ย้อนกลับ", 12f, -(RowHeight - 20f) / 2f, 200f, ModernUiTheme.SizeBody, ModernUiTheme.AccentInkColor);
            Value(card, title, -12f, -(RowHeight - 20f) / 2f, 300f, ModernUiTheme.LabelColor);
            return y + RowHeight + RowGap;
        }

        /// <summary>
        /// An empty row, banded, and a button when it leads somewhere.
        /// </summary>
        /// <remarks>
        /// The whole row is the button rather than a small arrow at the end. This is read on a
        /// phone as often as on a desktop, and a thumb is not a mouse pointer.
        /// </remarks>
        private RectTransform NewCard(float y, float height, System.Action onClick)
        {
            var card = ModernUiTheme.CreateCard(body, "Row", rows.Count % 2 == 0 ? RowAltColor : ModernUiTheme.CardColor);
            ModernUiTheme.Place(card, new Vector2(0, 1), new Vector2(Pad, -y), new Vector2(RowWidth, height));

            if (onClick != null)
            {
                var image = card.GetComponent<Image>();
                image.raycastTarget = true;
                var button = card.gameObject.AddComponent<Button>();
                button.targetGraphic = image;
                button.onClick.AddListener(() => onClick());
            }

            rows.Add(card.gameObject);
            return card;
        }

        private static void Label(RectTransform card, string text, float left, float top, float width,
            float size, Color color)
        {
            var label = ModernUiTheme.CreateText(card, "Label", text, size, color, TextAlignmentOptions.Left);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            label.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(label.rectTransform, new Vector2(0, 1), new Vector2(left, top), new Vector2(width, 20f));
        }

        private static void Value(RectTransform card, string text, float right, float top, float width, Color color)
        {
            var label = ModernUiTheme.CreateText(card, "Value", text, ModernUiTheme.SizeLabel, color, TextAlignmentOptions.Right);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            //Pivoted top right, so this positions the label's own right edge. Subtracting the
            //width as well - which reads as the natural thing to do - moves it a second width
            //to the left and lands it in the middle of whatever is beside it.
            ModernUiTheme.Place(label.rectTransform, new Vector2(1, 1), new Vector2(right, top), new Vector2(width, 20f));
        }

        /// <summary>
        /// An item's own icon, or nothing at all when the client has no picture for it.
        /// </summary>
        /// <remarks>
        /// Icons come out of an atlas built from the player's own GRF, so a missing one is an
        /// ordinary state here rather than a broken install - and a blank square where a hat
        /// should be reads worse than a row that simply has no picture.
        /// </remarks>
        private static bool DrawItemIcon(RectTransform card, int itemId, Vector2 position)
        {
            if (itemId <= 0 || ClientDataLoader.Instance == null)
                return false;
            if (!ClientDataLoader.Instance.TryGetItemById(itemId, out var data) || data == null)
                return false;

            var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(data.Sprite);
            if (sprite == null)
                return false;

            var icon = ModernUiTheme.CreateIcon(card, sprite, Color.white, RewardIconSize);
            ModernUiTheme.Place((RectTransform)icon.transform, new Vector2(0, 1), position,
                new Vector2(RewardIconSize, RewardIconSize));
            return true;
        }

        private static string ItemName(int itemId)
        {
            if (itemId <= 0 || ClientDataLoader.Instance == null)
                return "-";

            return ClientDataLoader.Instance.TryGetItemById(itemId, out var data) && data != null
                ? data.Name
                : "-";
        }
    }
}
