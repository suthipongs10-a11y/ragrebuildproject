using System.Collections.Generic;
using Assets.Scripts.Network;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.AdventureBook
{
    /// <summary>
    /// The adventure book: what has been hunted, what is left, and somewhere to go next.
    ///
    /// Three depths in one window rather than three windows - the regions, the pages of one
    /// region, and one page - because on a phone a second floating window is a window covering
    /// the one being read, and the three are one errand: pick a place, pick a thing, go there.
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
        private const float Width = 560f;
        private const float Height = 480f;
        private const float Pad = 8f;

        private const float HeaderHeight = 26f;
        private const float RowHeight = 40f;
        private const float RowGap = 4f;
        private const float BodyTop = ModernUiTheme.TitleBarHeight + HeaderHeight + Pad;

        /// <summary>The travel button on the right of a place row.</summary>
        private const float GoWidth = 78f;

        /// <summary>A star that has been earned, against one that has not.</summary>
        private static readonly Color EarnedColor = new Color(0.804f, 0.588f, 0.106f);

        private static readonly Color RowAltColor = new Color(0.937f, 0.957f, 0.980f);
        private static readonly Color DoneColor = new Color(0.106f, 0.412f, 0.208f);

        private enum View { Regions, Pages, Page }

        private static AdventureBookWindow instance;

        private RectTransform body;
        private TextMeshProUGUI header;
        private View view = View.Regions;
        private int regionIndex = -1;
        private int monsterId = -1;
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
            instance.monsterId = -1;

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

            var y = 0f;
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
                var row = NewRow(y, region.Complete ? DoneColor : ModernUiTheme.NameColor,
                    region.Name,
                    region.Complete ? "ครบแล้ว ✔" : $"{done}/{region.Pages.Count} หน้า",
                    () => { view = View.Pages; regionIndex = index; Redraw(); });

                rows.Add(row);
                y += RowHeight + RowGap;
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
            rows.Add(NewRow(y, ModernUiTheme.AccentInkColor, "◀ ย้อนกลับ", region.Name,
                () => { view = View.Regions; Redraw(); }));
            y += RowHeight + RowGap;

            foreach (var page in region.Pages)
            {
                var id = page.MonsterId;
                var target = page.HasHunt ? page.HuntTargetLarge : page.HuntTarget;
                var row = NewRow(y, page.IsComplete ? DoneColor : ModernUiTheme.NameColor,
                    $"{Stars(page)}  {page.Name}",
                    page.IsComplete ? "ครบแล้ว" : $"{page.Kills:N0}/{target:N0}",
                    () => { view = View.Page; monsterId = id; Redraw(); });

                rows.Add(row);
                y += RowHeight + RowGap;
            }

            return y + Pad;
        }

        private float DrawPage()
        {
            var y = Pad;
            if (!AdventureBookState.PagesByMonster.TryGetValue(monsterId, out var page))
            {
                view = View.Pages;
                return DrawPages();
            }

            rows.Add(NewRow(y, ModernUiTheme.AccentInkColor, "◀ ย้อนกลับ", $"{page.Name}  Lv {page.Level}",
                () => { view = View.Pages; Redraw(); }));
            y += RowHeight + RowGap;

            rows.Add(NewRow(y, page.HasHunt ? EarnedColor : ModernUiTheme.MutedColor,
                page.HasHunt ? "★ สำเร็จ" : "★",
                $"{Mathf.Min(page.Kills, page.HuntTarget):N0}/{page.HuntTarget:N0}", null));
            y += RowHeight + RowGap;

            rows.Add(NewRow(y, page.HasHuntLarge ? EarnedColor : ModernUiTheme.MutedColor,
                page.HasHuntLarge ? "★★ สำเร็จ" : "★★",
                $"{Mathf.Min(page.Kills, page.HuntTargetLarge):N0}/{page.HuntTargetLarge:N0}", null));
            y += RowHeight + RowGap;

            var cardLine = page.CardItemId <= 0
                ? "มอนตัวนี้ไม่ดรอปการ์ด"
                : page.HasCard ? "★★★ สำเร็จ" : "★★★ ต้องมีการ์ดของมอนตัวนี้";
            rows.Add(NewRow(y, page.HasCard ? EarnedColor : ModernUiTheme.MutedColor, cardLine, "", null));
            y += RowHeight + RowGap;

            if (page.Sightings == null || page.Sightings.Count == 0)
                return y + Pad;

            rows.Add(NewRow(y, ModernUiTheme.LabelColor, "เจอที่", page.HasHunt ? "" : "ต้องได้ ★ ก่อนถึงเดินทางได้", null));
            y += RowHeight + RowGap;

            foreach (var sighting in page.Sightings)
            {
                var map = sighting.Map;
                var id = page.MonsterId;
                var row = NewRow(y, ModernUiTheme.NameColor, map, $"{sighting.Count:N0} ตัว", null);
                rows.Add(row);

                if (page.HasHunt)
                {
                    var go = ModernUiTheme.CreateButton((RectTransform)row.transform, "Go", "ไปที่นี่",
                        ModernUiTheme.AccentColor, ModernUiTheme.AccentTextColor, ModernUiTheme.SizeLabel);
                    ModernUiTheme.Place((RectTransform)go.transform, new Vector2(1, 0.5f),
                        new Vector2(-GoWidth - 6f, -13f), new Vector2(GoWidth, 26f));
                    go.onClick.AddListener(() => NetworkManager.Instance.SendAdventureBookWarp(id, map));
                }

                y += RowHeight + RowGap;
            }

            return y + Pad;
        }

        private static string Stars(AdventureBookPage page)
        {
            var earned = page.StarCount;
            var max = page.MaxStars;
            var s = "";
            for (var i = 0; i < max; i++)
                s += i < earned ? "★" : "☆";
            return s;
        }

        /// <summary>
        /// One row: a label on the left, a value on the right, and optionally a click.
        /// </summary>
        /// <remarks>
        /// The whole row is the button when there is one, rather than a small arrow at the
        /// end. This is read on a phone as often as on a desktop, and a thumb is not a mouse
        /// pointer.
        /// </remarks>
        private GameObject NewRow(float y, Color labelColor, string label, string value, System.Action onClick)
        {
            var card = ModernUiTheme.CreateCard(body, "Row", rows.Count % 2 == 0 ? RowAltColor : ModernUiTheme.CardColor);
            ModernUiTheme.Place(card, new Vector2(0, 1), new Vector2(Pad, -y),
                new Vector2(Width - Pad * 4f, RowHeight));

            var text = ModernUiTheme.CreateText(card, "Label", label, ModernUiTheme.SizeBody,
                labelColor, TextAlignmentOptions.Left);
            text.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Stretch(text.rectTransform, 10, 0, -220, 0);

            if (!string.IsNullOrEmpty(value))
            {
                var right = ModernUiTheme.CreateText(card, "Value", value, ModernUiTheme.SizeLabel,
                    ModernUiTheme.MutedColor, TextAlignmentOptions.Right);
                right.textWrappingMode = TextWrappingModes.NoWrap;
                ModernUiTheme.Stretch(right.rectTransform, -220, 0, -10, 0);
            }

            if (onClick != null)
            {
                var image = card.GetComponent<Image>();
                image.raycastTarget = true;
                var button = card.gameObject.AddComponent<Button>();
                button.targetGraphic = image;
                button.onClick.AddListener(() => onClick());
            }

            return card.gameObject;
        }
    }
}
