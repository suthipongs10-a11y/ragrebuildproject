using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
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

        /// <summary>The rank panel under the title bar, and the pieces inside it.</summary>
        private const float HeaderHeight = 62f;

        private const float RankPanelHeight = 58f;
        private const float RankBadgeSize = 40f;
        private const float RankBarLeft = RankBadgeSize + 18f;
        private const float RankBarWidth = Width - Pad * 2f - RankBarLeft - 12f;
        private const float RankBarHeight = 20f;

        /// <summary>
        /// How the character in the title bar is scaled and shifted, so the badge holds a face
        /// rather than a whole person.
        /// </summary>
        /// <remarks>
        /// A player sprite is drawn upward from its feet - that is where its anchor is - and
        /// stands roughly a hundred and ten pixels tall at scale one, of which the head is the
        /// top four tenths. So to put a head in a forty four pixel badge: scale it until the
        /// head alone is about that tall, then push the feet down by however far the head then
        /// sits above them.
        ///
        ///     head height  = 110 * 0.4 * scale        44 wants a scale of about 1
        ///     drop         = -110 * 0.8 * scale       which is where the head's middle is
        ///
        /// The first attempt used 0.42 and showed the whole character, which is the same
        /// picture the equipment window already gives and unreadable at this size.
        ///
        /// Still the two numbers to nudge. Bigger scale zooms in; more negative drop slides
        /// the character down, so the badge looks further up it.
        /// </remarks>
        private const float PortraitScale = 1f;
        private const float PortraitDrop = -88f;
        private const float PortraitBadgeSize = 44f;
        private const float RowHeight = 44f;
        private const float TallRowHeight = 56f;
        private const float RowGap = 5f;
        private const float BodyTop = ModernUiTheme.TitleBarHeight + HeaderHeight + Pad;

        /// <summary>Inside the scroll tray, once the tray's own margins are taken off.</summary>
        private const float RowWidth = Width - Pad * 4f;

        private const float StarSize = 18f;
        private const float ChevronSize = 16f;
        private const float RewardIconSize = 30f;

        /// <summary>A reward line inside a star row: one icon and the name beside it.</summary>
        private const float RewardLineHeight = 24f;
        private const float RewardIconSmall = 22f;

        /// <summary>Where the reward column starts, measured from the left of a row.</summary>
        private const float RewardColumn = RowWidth - 232f;

        private const float GoWidth = 116f;

        /// <summary>A star that has been earned, against one that has not.</summary>
        private static readonly Color EarnedColor = new Color(0.918f, 0.694f, 0.145f);
        private static readonly Color UnearnedColor = new Color(0.741f, 0.780f, 0.827f);

        private static readonly Color RowAltColor = new Color(0.945f, 0.961f, 0.980f);

        /// <summary>What the four things this window does are drawn on, against the list's own card.</summary>
        private static readonly Color MenuRowColor = new Color(0.831f, 0.894f, 0.976f);
        private static readonly Color DoneColor = new Color(0.106f, 0.412f, 0.208f);
        private static readonly Color TrackColor = new Color(0.816f, 0.859f, 0.910f);

        /// <summary>
        /// The Adventure rank gauge, which is its own colour rather than the experience bar's.
        /// </summary>
        /// <remarks>
        /// It started as GaugeExpColor so it would read as an experience bar, and reading as
        /// one is exactly the problem: a second gold bar a few pixels from the real one is a
        /// bar somebody checks twice. Orange is close enough to say "this fills up" and far
        /// enough to say "this is not your level".
        /// </remarks>
        private static readonly Color RankFillColor = new Color(0.937f, 0.478f, 0.129f);
        private static readonly Color FillColor = new Color(0.235f, 0.545f, 0.851f);

        private enum View { Regions, Pages, Page, Rewards, Ranks, Status, Bosses, Box, Help }

        private static AdventureBookWindow instance;

        private RectTransform body;
        private TextMeshProUGUI header;
        private TextMeshProUGUI rankNote;
        private TextMeshProUGUI rankBadgeText;
        private TextMeshProUGUI rankBarText;
        private RectTransform rankFill;
        private RectTransform titleBar;
        private UiPlayerSprite portrait;

        /// <summary>
        /// The appearance the portrait was last built from, so it is not rebuilt for nothing.
        /// </summary>
        /// <remarks>
        /// Preparing the same character twice is not free and it is not safe: each prepare
        /// resets the counter that says how many parts are still loading, so a second one
        /// started before the first has finished can have a part counted twice and another
        /// not at all. Rebuilding only when the character actually looks different avoids
        /// the question entirely.
        /// </remarks>
        private int portraitAppearance = -1;
        private View view = View.Regions;
        private int regionIndex = -1;
        private int pageId = -1;
        private int drawnRevision = -1;
        private int statusSignature;

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
            instance.RefreshPortrait();
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

            var titleBar = ModernUiTheme.CreateTitleBar(window, "สมุดผจญภัย", "", ModernUiIcons.Spark);
            ModernUiTheme.AttachShadow(rect);
            window.titleBar = titleBar;

            //The whole rank block sits on a panel of its own rather than floating on the
            //window's own sheet. It is a different kind of thing from the list below it -
            //it is about the reader, not about the book - and a panel is what says so.
            var panel = ModernUiTheme.CreateCard(rect, "RankPanel", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Place(panel, new Vector2(0, 1), new Vector2(Pad, -(ModernUiTheme.TitleBarHeight + 2f)),
                new Vector2(Width - Pad * 2f, RankPanelHeight));
            panel.GetComponent<Image>().raycastTarget = false;

            //The rank as a number on a badge, which is how a level is read at a glance in
            //every game that has one - the word beside it is for the first time only.
            var badge = ModernUiTheme.CreateCard(panel, "RankBadge", ModernUiTheme.AccentColor);
            ModernUiTheme.Place(badge, new Vector2(0, 1), new Vector2(9f, -9f),
                new Vector2(RankBadgeSize, RankBadgeSize));
            badge.GetComponent<Image>().raycastTarget = false;

            window.rankBadgeText = ModernUiTheme.CreateText(badge, "RankNumber", "0", ModernUiTheme.SizeValue,
                ModernUiTheme.AccentTextColor, TextAlignmentOptions.Center, FontStyles.Bold);
            ModernUiTheme.Stretch(window.rankBadgeText.rectTransform, 0f, 0f, 0f, 0f);

            window.header = ModernUiTheme.CreateText(panel, "Header", "", ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            window.header.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(window.header.rectTransform, new Vector2(0, 1),
                new Vector2(RankBarLeft, -6f), new Vector2(RankBarWidth * 0.55f, 18f));

            window.rankNote = ModernUiTheme.CreateText(panel, "RankNote", "", ModernUiTheme.SizeLabel,
                ModernUiTheme.MutedColor, TextAlignmentOptions.Right);
            window.rankNote.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(window.rankNote.rectTransform, new Vector2(1, 1),
                new Vector2(-12f, -6f), new Vector2(RankBarWidth * 0.45f, 18f));

            //Built once and only resized, rather than drawn with the rows - it belongs to the
            //window, not to whichever page is open, and a bar destroyed and rebuilt on every
            //redraw flickers on every kill.
            var track = ModernUiTheme.CreateCard(panel, "RankTrack", ModernUiTheme.GaugeTrackColor);
            ModernUiTheme.Place(track, new Vector2(0, 1), new Vector2(RankBarLeft, -30f),
                new Vector2(RankBarWidth, RankBarHeight));
            track.GetComponent<Image>().raycastTarget = false;
            track.gameObject.AddComponent<RectMask2D>();

            window.rankFill = ModernUiTheme.CreateCard(track, "RankFill", RankFillColor);
            ModernUiTheme.Place(window.rankFill, new Vector2(0, 1), Vector2.zero,
                new Vector2(0f, RankBarHeight));
            window.rankFill.GetComponent<Image>().raycastTarget = false;

            //Written across the bar rather than beside it, the way an experience bar reads.
            //It is the same trick that lets the panel stay under sixty pixels tall.
            window.rankBarText = ModernUiTheme.CreateText(track, "RankBarText", "", ModernUiTheme.SizeSmall,
                ModernUiTheme.LightInkColor, TextAlignmentOptions.Center, FontStyles.Bold);
            window.rankBarText.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Stretch(window.rankBarText.rectTransform, 0f, 0f, 0f, 0f);

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

            //After the window is live, not while it is being assembled. The character's parts
            //are loaded through Addressables and the callback that assembles them does not
            //run against an inactive object, so a portrait built a few lines earlier is a
            //portrait that never arrives.
            window.RefreshPortrait();

            return window;
        }

        /// <summary>
        /// Puts the reader's own character in the badge at the top left of the window.
        /// </summary>
        /// <remarks>
        /// The same component the equipment window uses to draw its paper doll, borrowed
        /// whole - including its material, which is a serialised reference on a prefab and
        /// so cannot be created from here. If the equipment window is not in the scene the
        /// badge keeps the plain icon the title bar gave it, which is the right failure: a
        /// window that opens with a symbol on it, rather than one that does not open.
        ///
        /// Masked and scaled down to a face. A whole character at forty pixels is a smudge,
        /// and the head is the part that says which job this is.
        /// </remarks>
        private void RefreshPortrait()
        {
            //Wrapped, which is not this project's habit and is deliberate here. The portrait
            //is decoration on a window whose job is to show the book; the character sprite
            //system it borrows is asynchronous and shared with two other windows, and a throw
            //from inside it used to take the whole open with it - the book asked for nothing,
            //received nothing, and sat on "loading" until it was closed. A badge with no face
            //in it is a far better failure than that.
            try
            {
                BuildPortrait();
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"The adventure book could not draw its character portrait, so it goes without one: {e.Message}");
            }
        }

        private void BuildPortrait()
        {
            var state = PlayerState.Instance;
            if (titleBar == null || state == null)
                return;

            var appearance = (state.JobId * 397 + state.HairStyleId) * 31 + state.HairColorId * 2
                             + (state.IsMale ? 1 : 0);

            if (portrait != null)
            {
                //Already built. Only worth doing again if the character looks different now.
                if (appearance != portraitAppearance)
                {
                    portraitAppearance = appearance;
                    portrait.PrepareDisplayPlayerCharacter(state.JobId, state.HairStyleId, state.HairColorId,
                        0, 0, 0, state.IsMale);
                }

                return;
            }

            var badge = titleBar.Find("Icon") as RectTransform;
            if (badge == null)
                return;

            var ui = UiManager.Instance;
            var source = ui == null || ui.EquipmentWindow == null ? null : ui.EquipmentWindow.PlayerSprite;
            if (source == null || source.Material == null)
                return;

            //The badge grows a little to hold a face, and the plain icon it was given goes.
            badge.sizeDelta = new Vector2(PortraitBadgeSize, PortraitBadgeSize);
            var plain = badge.Find("Icon");
            if (plain != null)
                plain.gameObject.SetActive(false);

            var frame = ModernUiTheme.CreateRect("Portrait", badge);
            frame.anchorMin = Vector2.zero;
            frame.anchorMax = Vector2.one;
            frame.offsetMin = new Vector2(2f, 2f);
            frame.offsetMax = new Vector2(-2f, -2f);
            frame.gameObject.AddComponent<RectMask2D>();

            //A rect rather than a plain transform. Everything under a canvas is laid out
            //through rects, and the sprite parts this hangs are canvas graphics.
            var characterHost = ModernUiTheme.CreateRect("Character", frame);
            characterHost.anchorMin = new Vector2(0.5f, 0.5f);
            characterHost.anchorMax = new Vector2(0.5f, 0.5f);
            characterHost.pivot = new Vector2(0.5f, 0.5f);
            characterHost.sizeDelta = new Vector2(PortraitBadgeSize, PortraitBadgeSize);
            characterHost.anchoredPosition = new Vector2(0f, PortraitDrop);
            characterHost.localScale = new Vector3(PortraitScale, PortraitScale, 1f);

            portrait = characterHost.gameObject.AddComponent<UiPlayerSprite>();
            portrait.Material = source.Material;
            portrait.ViewDirection = Direction.South;

            //No headgear. At this size a hat is a smudge on a face, and the face is the part
            //that says which job is reading the book.
            portraitAppearance = appearance;
            portrait.PrepareDisplayPlayerCharacter(state.JobId, state.HairStyleId, state.HairColorId,
                0, 0, 0, state.IsMale);
        }

        private void Update()
        {
            if (drawnRevision != AdventureBookState.Revision)
            {
                Redraw();
                return;
            }

            //The status page is the only one drawn from numbers the book does not own - a
            //potion, a hat or a guild skill moves them without touching the book's revision.
            //Watched by a cheap signature rather than redrawn every frame, because a redraw
            //here throws away thirty rows and builds thirty more.
            if (view == View.Status && statusSignature != StatusSignature())
                Redraw();
        }

        /// <summary>
        /// A number that changes when anything the status page shows changes.
        /// </summary>
        /// <remarks>
        /// Not a hash of everything - only of what is actually drawn, so that a stat update
        /// carrying a hit point change does not rebuild a page where no number moved.
        /// </remarks>
        private static int StatusSignature()
        {
            var state = PlayerState.Instance;
            if (state == null)
                return 0;

            var value = AdventureBookState.Rank * 397 + state.Level * 17 + state.JobId;
            for (var stat = PlayerStat.Str; stat <= PlayerStat.Luk; stat++)
                value = value * 31 + state.GetData(stat);
            for (var stat = CharacterStat.AddStr; stat <= CharacterStat.AddLuk; stat++)
                value = value * 31 + state.GetStat(stat);

            value = value * 31 + state.GetStat(CharacterStat.AddDropPercent);
            value = value * 31 + state.GetStat(CharacterStat.AddExpPercent);
            value = value * 31 + state.GetStat(CharacterStat.Attack);
            value = value * 31 + state.GetStat(CharacterStat.Def);
            value = value * 31 + GuildState.Skills.Count;
            foreach (var skill in GuildState.Skills)
                value = value * 31 + skill.Level;

            return value;
        }

        // =====================================================================
        // Drawing

        private void Redraw()
        {
            drawnRevision = AdventureBookState.Revision;
            statusSignature = StatusSignature();

            foreach (var row in rows)
                if (row != null)
                    Destroy(row);
            rows.Clear();

            if (!AdventureBookState.Received)
            {
                header.text = "กำลังโหลด...";
                rankNote.text = "";
                rankBadgeText.text = "-";
                rankBarText.text = "";
                rankFill.sizeDelta = new Vector2(0f, RankBarHeight);
                return;
            }

            rankBadgeText.text = AdventureBookState.Rank.ToString();
            header.text = "Adventure Rank";
            rankNote.text = $"{AdventureBookState.Stars:N0} / {AdventureBookState.StarTotal:N0} ดาวทั้งเล่ม";

            //Measured between the two ranks rather than against the whole book, so the bar
            //answers the question actually being asked - how far to the next rank - and does
            //not crawl for the first thirty stars and then leap.
            var next = AdventureBookState.StarsForNextRank;
            var floor = AdventureBookState.StarsAtRank;
            if (next > floor)
            {
                var span = next - floor;
                var into = Mathf.Clamp(AdventureBookState.Stars - floor, 0, span);
                rankBarText.text = $"{into:N0} / {span:N0}   ·   อีก {next - AdventureBookState.Stars:N0} ดาวถึงระดับ {AdventureBookState.Rank + 1}";
                rankFill.sizeDelta = new Vector2(RankBarWidth * into / span, RankBarHeight);
            }
            else if (AdventureBookState.Rank < AdventureBookState.Ranks.Count)
            {
                //The last rank is not for sale at any number of stars - it asks for every
                //region finished - so a bar towards it would be a bar that never moves.
                rankBarText.text = $"ทำครบทุกเมืองเพื่อไประดับ {AdventureBookState.Ranks.Count}";
                rankFill.sizeDelta = new Vector2(RankBarWidth, RankBarHeight);
            }
            else
            {
                rankBarText.text = "ระดับสูงสุดแล้ว";
                rankFill.sizeDelta = new Vector2(RankBarWidth, RankBarHeight);
            }

            var y = Pad;
            switch (view)
            {
                case View.Regions: y = DrawRegions(); break;
                case View.Pages: y = DrawPages(); break;
                case View.Page: y = DrawPage(); break;
                case View.Rewards: y = DrawRewards(); break;
                case View.Ranks: y = DrawRanks(); break;
                case View.Status: y = DrawStatus(); break;
                case View.Bosses: y = DrawBosses(); break;
                case View.Box: y = DrawBox(); break;
                case View.Help: y = DrawHelp(); break;
            }

            body.sizeDelta = new Vector2(0, y);
        }

        private float DrawRegions()
        {
            var y = Pad;

            y = MenuRow(y, ModernUiIcons.Helmet, "รางวัลประจำเมืองและดันเจี้ยน",
                $"{AdventureBookState.Regions.Count} ชิ้น", () => { view = View.Rewards; Redraw(); });

            y = MenuRow(y, ModernUiIcons.Person, "สถานะรวมของตัวละคร", RateSummary(),
                () => { view = View.Status; Redraw(); });

            y = MenuRow(y, ModernUiIcons.Star, "รางวัลระดับ Adventure",
                $"ระดับ {AdventureBookState.Rank} / {AdventureBookState.Ranks.Count}",
                () => { view = View.Ranks; Redraw(); });

            if (AdventureBookState.HasBossLog)
                y = MenuRow(y, ModernUiIcons.Sword, "บันทึกล่าจอมมาร",
                    $"{AdventureBookState.BossFound} / {AdventureBookState.BossTotal} ตัว",
                    () => { view = View.Bosses; Redraw(); });

            y = MenuRow(y, ModernUiIcons.Book, "คู่มือนักผจญภัย", "วิธีเล่น",
                () => { view = View.Help; Redraw(); });

            //A rule between the four things this window can do and the places it lists, so
            //the eye stops once rather than reading twenty-eight rows as one list.
            var divider = ModernUiTheme.CreateCard(body, "Divider", ModernUiTheme.CardBorderColor);
            ModernUiTheme.Place(divider, new Vector2(0, 1), new Vector2(Pad + 4f, -(y + 4f)),
                new Vector2(RowWidth - 8f, 2f));
            divider.GetComponent<Image>().raycastTarget = false;
            rows.Add(divider.gameObject);
            y += 14f;

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
            var rewards = AdventureBookState.RewardFor(page.Level, starIndex);

            //Tall enough for whatever the star pays. Three lines of reward on a row sized for
            //one is three lines drawn on top of each other.
            var height = Mathf.Max(TallRowHeight, 16f + rewards.Count * RewardLineHeight);
            var card = NewCard(y, height, null);

            var star = ModernUiTheme.CreateIcon(card, ModernUiIcons.Star, earned ? EarnedColor : UnearnedColor, StarSize);
            ModernUiTheme.Place((RectTransform)star.transform, new Vector2(0, 1),
                new Vector2(12f, -12f), new Vector2(StarSize, StarSize));

            var textLeft = 12f + StarSize + 10f;
            Label(card, earned ? label + "   สำเร็จ" : label, textLeft, -10f, 200f,
                ModernUiTheme.SizeBody, earned ? DoneColor : ModernUiTheme.NameColor);

            if (target > 0)
            {
                var shown = Mathf.Min(kills, target);
                Label(card, $"{shown:N0}/{target:N0}", textLeft, -32f, 90f,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);
                DrawBar(card, textLeft + 92f, -36f, 150f, (float)shown / target);
            }
            else if (!earned)
            {
                Label(card, "เก็บการ์ดที่มอนตัวนี้ดรอป", textLeft, -32f, 260f,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);
            }

            for (var i = 0; i < rewards.Count; i++)
                DrawRewardLine(card, rewards[i], 10f + i * RewardLineHeight);

            return y + height + RowGap;
        }

        /// <summary>
        /// One thing a star pays: its own icon, its real name, and how many.
        /// </summary>
        /// <remarks>
        /// Clickable, and what it opens is the game's own item window - so the full properties
        /// of a reward are one tap away without this window having to know what a hat does.
        /// </remarks>
        private void DrawRewardLine(RectTransform card, AdventureBookReward reward, float top)
        {
            if (!reward.HasItem)
                return;

            var id = reward.ItemId;
            var drawn = DrawItemIcon(card, id, new Vector2(RewardColumn, -top), RewardIconSmall);
            var left = RewardColumn + (drawn ? RewardIconSmall + 6f : 0f);

            var name = ItemName(id);
            if (reward.Count > 1)
                name += $" x{reward.Count}";

            var label = ModernUiTheme.CreateText(card, "Reward", name, ModernUiTheme.SizeSmall,
                ModernUiTheme.NameColor, TextAlignmentOptions.Left);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            label.overflowMode = TextOverflowModes.Ellipsis;
            label.raycastTarget = true;
            ModernUiTheme.Place(label.rectTransform, new Vector2(0, 1), new Vector2(left, -top - 2f),
                new Vector2(RowWidth - left - 12f, RewardIconSmall));

            var button = label.gameObject.AddComponent<Button>();
            button.targetGraphic = label;
            button.onClick.AddListener(() => ShowItem(id));
        }

        /// <summary>Opens the game's own item window, which already knows how to describe anything.</summary>
        private static void ShowItem(int itemId)
        {
            if (itemId <= 0 || UiManager.Instance == null || UiManager.Instance.ItemDescriptionWindow == null)
                return;

            UiManager.Instance.ItemDescriptionWindow.ShowItemDescription(itemId);
        }

        /// <summary>Every region's headgear in one place, which is the page people come for.</summary>
        private float DrawRewards()
        {
            var y = Pad;
            y = BackRow(y, "รางวัลประจำเมืองและดันเจี้ยน", () => { view = View.Regions; Redraw(); });

            var note = NewCard(y, RowHeight, null);
            Label(note, "ทำครบทุกหน้าของเมืองนั้น ถึงจะได้", 12f, -(RowHeight - 20f) / 2f,
                RowWidth - 24f, ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);
            y += RowHeight + RowGap;

            foreach (var region in AdventureBookState.Regions)
            {
                var id = region.RewardItemId;
                var card = NewCard(y, TallRowHeight, () => ShowItem(id));

                var drawn = DrawItemIcon(card, id, new Vector2(12f, -(TallRowHeight - RewardIconSize) / 2f));
                var left = drawn ? 12f + RewardIconSize + 10f : 14f;

                Label(card, ItemName(id), left, -8f, 300f, ModernUiTheme.SizeBody,
                    region.Complete ? DoneColor : ModernUiTheme.NameColor);
                Label(card, region.Name, left, -30f, 300f, ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);

                Value(card, region.Complete ? "ได้แล้ว" : "ยังไม่ได้", -12f, -(TallRowHeight - 20f) / 2f, 140f,
                    region.Complete ? DoneColor : ModernUiTheme.MutedColor);

                y += TallRowHeight + RowGap;
            }

            return y + Pad;
        }

        /// <summary>
        /// The rank ladder: what each rung asks for, what it is permanently worth, and what it
        /// hands over on the way past.
        /// </summary>
        /// <remarks>
        /// Drawn whole rather than one rung at a time. The stars for rank ten are a month of
        /// play, and nobody spends a month on a number they have to take on faith - the page
        /// exists so the Valkyrie set at the top is visible from the bottom.
        /// </remarks>
        private float DrawRanks()
        {
            var y = Pad;
            y = BackRow(y, "รางวัลระดับ Adventure", () => { view = View.Regions; Redraw(); });

            for (var i = 0; i < AdventureBookState.Ranks.Count; i++)
            {
                var rank = i + 1;
                var info = AdventureBookState.Ranks[i];
                var reached = AdventureBookState.Rank >= rank;

                //One line per reward, plus the two the heading takes.
                var lines = 0;
                if (info.Rewards != null)
                    foreach (var reward in info.Rewards)
                        if (reward.HasItem)
                            lines++;

                //Room for the four lines on the left as well, so a rank that pays little does
                //not draw its bonus off the bottom of its own card.
                var height = Mathf.Max(94f, 38f + lines * RewardLineHeight);
                var card = NewCard(y, height, null);

                //Said on the rank's own line rather than off on the right, because the right
                //of this card is the reward column and a word placed there lands on an icon.
                Label(card, reached ? $"ระดับ {rank}   ได้แล้ว" : $"ระดับ {rank}", 12f, -8f, 200f,
                    ModernUiTheme.SizeBody, reached ? DoneColor : ModernUiTheme.NameColor);
                Label(card, rank >= AdventureBookState.Ranks.Count
                        ? $"ดาว {info.Stars:N0} และครบทุกเมือง"
                        : $"ดาว {info.Stars:N0}",
                    12f, -30f, 220f, ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);

                //Two lines rather than one. Four bonuses joined with separators is wider than
                //the column that holds them, and the one that fell off the end was the refine
                //chance - the bonus somebody reads the page for.
                var parts = BonusParts(info);
                for (var line = 0; line * 2 < parts.Count; line++)
                {
                    var take = parts.GetRange(line * 2, Mathf.Min(2, parts.Count - line * 2));
                    Label(card, string.Join("   ·   ", take), 12f, -(52f + line * 18f), RewardColumn - 24f,
                        ModernUiTheme.SizeSmall, ModernUiTheme.AccentInkColor);
                }

                if (info.Rewards != null)
                {
                    var line = 0;
                    foreach (var reward in info.Rewards)
                    {
                        if (!reward.HasItem)
                            continue;
                        DrawRewardLine(card, reward, 10f + line * RewardLineHeight);
                        line++;
                    }
                }

                y += height + RowGap;
            }

            return y + Pad;
        }

        /// <summary>What a rank is permanently worth, one piece at a time.</summary>
        /// <remarks>
        /// Returned in pieces rather than as a sentence so that whoever draws it can decide
        /// how many fit on a line. Joined into one string, the last of the four ran past the
        /// end of its column and was quietly cut off.
        /// </remarks>
        private static List<string> BonusParts(AdventureBookRankInfo info)
        {
            var parts = new List<string>(4);
            if (info.StatBonus > 0) parts.Add($"สเตตัสทุกช่อง +{info.StatBonus}");
            if (info.DropPercent > 0) parts.Add($"ดรอป +{info.DropPercent}%");
            if (info.ExpPercent > 0) parts.Add($"EXP +{info.ExpPercent}%");
            if (info.RefinePercent > 0) parts.Add($"ตีบวก +{info.RefinePercent}%");

            return parts;
        }

        private static string BonusText(AdventureBookRankInfo info) =>
            string.Join("   ·   ", BonusParts(info));

        /// <summary>
        /// Everything the character is currently worth, and where it came from.
        /// </summary>
        /// <remarks>
        /// Here rather than in the stats window because most of what it answers is this book's
        /// doing. Adventure rank hands out stats, drop rate, experience and refine chance; the
        /// guild hands out more; Battle Manual and Bubble Gum double two of them for half an
        /// hour. None of it was visible anywhere. A permanent bonus nobody can see is one
        /// nobody believes in, and the complaint that follows is that the reward does nothing.
        ///
        /// The split is only ever as honest as the client can be. Rank is exact - the ladder
        /// says what each rung gives. Guild is exact - the same table the server adds from is
        /// read here. Everything left over is equipment, cards and buffs together, and it is
        /// labelled as that rather than guessed at further.
        /// </remarks>
        private float DrawStatus()
        {
            var y = Pad;
            y = BackRow(y, "สถานะรวมของตัวละคร", () => { view = View.Regions; Redraw(); });

            var state = PlayerState.Instance;
            if (state == null)
                return y + Pad;

            var rank = RankBonus();
            var guild = GuildBonus();

            var who = NewCard(y, TallRowHeight, null);
            Label(who, state.PlayerName, 12f, -8f, RowWidth - 24f, ModernUiTheme.SizeBody, ModernUiTheme.NameColor);
            //Asked with == null rather than ?., the same way the rest of this file asks: these
            //are UnityEngine objects and the null-conditional tests the reference where == asks
            //Unity whether the thing is still alive.
            var jobName = ClientDataLoader.Instance == null ? "-" : ClientDataLoader.Instance.GetJobNameForId(state.JobId);
            Label(who, $"{jobName}   ·   Base {state.Level}   ·   Job {state.GetData(PlayerStat.JobLevel)}",
                12f, -30f, RowWidth - 24f, ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);
            Value(who, $"Adventure {AdventureBookState.Rank}", -12f, -8f, 180f, ModernUiTheme.AccentInkColor);
            y += TallRowHeight + RowGap;

            y = GroupRow(y, "สเตตัสหลัก");
            y = StatLine(y, "STR", PlayerStat.Str, CharacterStat.AddStr, rank.StatBonus, guild.Str);
            y = StatLine(y, "AGI", PlayerStat.Agi, CharacterStat.AddAgi, rank.StatBonus, guild.Agi);
            y = StatLine(y, "VIT", PlayerStat.Vit, CharacterStat.AddVit, rank.StatBonus, guild.Vit);
            y = StatLine(y, "INT", PlayerStat.Int, CharacterStat.AddInt, rank.StatBonus, guild.Int);
            y = StatLine(y, "DEX", PlayerStat.Dex, CharacterStat.AddDex, rank.StatBonus, guild.Dex);
            y = StatLine(y, "LUK", PlayerStat.Luk, CharacterStat.AddLuk, rank.StatBonus, guild.Luk);

            y = GroupRow(y, "ค่าต่อสู้");
            y = PlainLine(y, "ATK", $"{state.GetStat(CharacterStat.Attack)} ~ {state.GetStat(CharacterStat.Attack2)}");
            y = PlainLine(y, "MATK", $"{state.GetStat(CharacterStat.MagicAtkMin)} ~ {state.GetStat(CharacterStat.MagicAtkMax)}");
            y = PlainLine(y, "DEF / MDEF", $"{state.GetStat(CharacterStat.Def)} / {state.GetStat(CharacterStat.MDef)}");
            y = PlainLine(y, "HIT", $"{Total(PlayerStat.Dex, CharacterStat.AddDex) + state.Level + state.GetStat(CharacterStat.AddHit)}");
            y = PlainLine(y, "FLEE", $"{Total(PlayerStat.Agi, CharacterStat.AddAgi) + state.Level + state.GetStat(CharacterStat.AddFlee)} + {state.GetStat(CharacterStat.PerfectDodge)}");
            y = PlainLine(y, "ASPD", $"{(1f / Mathf.Max(0.0001f, state.AttackSpeed)):F2} ครั้ง/วินาที");

            y = GroupRow(y, "อัตราพิเศษ");
            y = RateLine(y, "อัตราดรอปไอเทม", state.GetStat(CharacterStat.AddDropPercent), rank.DropPercent, 0);
            y = RateLine(y, "EXP ที่ได้รับ", state.GetStat(CharacterStat.AddExpPercent) + guild.ExpPercent,
                rank.ExpPercent, guild.ExpPercent);
            y = RateLine(y, "โอกาสตีบวกสำเร็จ", rank.RefinePercent, rank.RefinePercent, 0);

            y = GroupRow(y, "ที่มาของโบนัส");

            var rankLine = BonusText(rank);
            y = SourceRow(y, $"Adventure ระดับ {AdventureBookState.Rank}",
                string.IsNullOrEmpty(rankLine) ? "ยังไม่ได้โบนัส สะสมดาวให้ถึงระดับ 1 ก่อน" : rankLine);

            y = SourceRow(y, string.IsNullOrEmpty(GuildState.GuildName) ? "กิลด์" : $"กิลด์ {GuildState.GuildName}",
                guild.Text.Length == 0 ? "ยังไม่มีสกิลกิลด์ที่ให้โบนัส" : guild.Text);

            y = SourceRow(y, "อุปกรณ์ การ์ด และบัฟ",
                "ส่วนที่เหลือจากตัวเลขด้านบน หลังหักโบนัสของ Adventure และกิลด์ออกแล้ว");

            return y + Pad;
        }

        /// <summary>The one line that fits beside a button: what the two rates are worth right now.</summary>
        private static string RateSummary()
        {
            var state = PlayerState.Instance;
            if (state == null)
                return "";

            var drop = state.GetStat(CharacterStat.AddDropPercent);
            var exp = state.GetStat(CharacterStat.AddExpPercent) + GuildBonus().ExpPercent;
            return $"ดรอป +{drop}%  ·  EXP +{exp}%";
        }

        private static int Total(PlayerStat baseStat, CharacterStat bonusStat)
        {
            var state = PlayerState.Instance;
            return state == null ? 0 : state.GetData(baseStat) + state.GetStat(bonusStat);
        }

        /// <summary>What the character's rank is worth, straight off the ladder the server sent.</summary>
        private static AdventureBookRankInfo RankBonus()
        {
            var rank = AdventureBookState.Rank;
            if (rank <= 0 || rank > AdventureBookState.Ranks.Count)
                return default;

            return AdventureBookState.Ranks[rank - 1];
        }

        /// <summary>What one stat is worth, split three ways.</summary>
        private float StatLine(float y, string name, PlayerStat baseStat, CharacterStat bonusStat,
            int fromRank, int fromGuild)
        {
            var state = PlayerState.Instance;
            var baseValue = state.GetData(baseStat);
            var bonus = state.GetStat(bonusStat);

            var card = NewCard(y, RowHeight, null);
            Label(card, name, 12f, -(RowHeight - 20f) / 2f, 80f, ModernUiTheme.SizeBody, ModernUiTheme.NameColor);

            var parts = new List<string>(3);
            if (fromRank > 0) parts.Add($"Adventure +{fromRank}");
            if (fromGuild > 0) parts.Add($"กิลด์ +{fromGuild}");
            var other = bonus - fromRank - fromGuild;
            if (other != 0) parts.Add($"อุปกรณ์/บัฟ {(other > 0 ? "+" : "")}{other}");

            if (parts.Count > 0)
                Label(card, string.Join("   ", parts), 92f, -(RowHeight - 20f) / 2f, RewardColumn - 100f,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);

            Value(card, bonus == 0 ? $"{baseValue}" : $"{baseValue} + {bonus} = {baseValue + bonus}",
                -12f, -(RowHeight - 20f) / 2f, 200f, ModernUiTheme.NameColor);

            return y + RowHeight + RowGap;
        }

        /// <summary>A number with nothing to break down: what it is, and that is all.</summary>
        private float PlainLine(float y, string name, string value)
        {
            var card = NewCard(y, RowHeight, null);
            Label(card, name, 12f, -(RowHeight - 20f) / 2f, 220f, ModernUiTheme.SizeBody, ModernUiTheme.NameColor);
            Value(card, value, -12f, -(RowHeight - 20f) / 2f, 240f, ModernUiTheme.NameColor);
            return y + RowHeight + RowGap;
        }

        /// <summary>A percentage, and which of the things this server added is behind it.</summary>
        private float RateLine(float y, string name, int total, int fromRank, int fromGuild)
        {
            var card = NewCard(y, RowHeight, null);
            Label(card, name, 12f, -(RowHeight - 20f) / 2f, 200f, ModernUiTheme.SizeBody, ModernUiTheme.NameColor);

            var parts = new List<string>(3);
            if (fromRank > 0) parts.Add($"Adventure +{fromRank}%");
            if (fromGuild > 0) parts.Add($"กิลด์ +{fromGuild}%");
            var other = total - fromRank - fromGuild;
            if (other != 0) parts.Add($"อื่น ๆ {(other > 0 ? "+" : "")}{other}%");

            if (parts.Count > 0)
                Label(card, string.Join("   ", parts), 212f, -(RowHeight - 20f) / 2f, RewardColumn - 220f,
                    ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);

            Value(card, $"+{total}%", -12f, -(RowHeight - 20f) / 2f, 140f,
                total > 0 ? DoneColor : ModernUiTheme.MutedColor);

            return y + RowHeight + RowGap;
        }

        private float GroupRow(float y, string title)
        {
            var card = NewCard(y, 30f, null);
            Label(card, title, 12f, -5f, RowWidth - 24f, ModernUiTheme.SizeBody, ModernUiTheme.AccentInkColor);
            return y + 30f + RowGap;
        }

        private float SourceRow(float y, string title, string text)
        {
            var card = NewCard(y, TallRowHeight, null);
            Label(card, title, 12f, -8f, RowWidth - 24f, ModernUiTheme.SizeBody, ModernUiTheme.NameColor);

            var line = ModernUiTheme.CreateText(card, "Body", text, ModernUiTheme.SizeSmall,
                ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Place(line.rectTransform, new Vector2(0, 1), new Vector2(12f, -28f),
                new Vector2(RowWidth - 24f, 26f));

            return y + TallRowHeight + RowGap;
        }

        /// <summary>What the guild is worth, read from the same table the server adds from.</summary>
        private readonly struct GuildBonusTotals
        {
            public readonly int Str, Agi, Vit, Int, Dex, Luk, ExpPercent;
            public readonly string Text;

            public GuildBonusTotals(int str, int agi, int vit, int intel, int dex, int luk,
                int expPercent, string text)
            {
                Str = str; Agi = agi; Vit = vit; Int = intel; Dex = dex; Luk = luk;
                ExpPercent = expPercent; Text = text;
            }
        }

        private static GuildBonusTotals GuildBonus()
        {
            int str = 0, agi = 0, vit = 0, intel = 0, dex = 0, luk = 0, exp = 0;
            var parts = new List<string>();

            foreach (var skill in GuildState.Skills)
            {
                if (skill.Level <= 0)
                    continue;

                var effect = GuildSkillBonus.For((GuildSkill)skill.Id);
                var amount = skill.Level * effect.PerLevel;
                if (amount == 0)
                    continue;

                switch (effect.Stat)
                {
                    case CharacterStat.AddStr: str += amount; break;
                    case CharacterStat.AddAgi: agi += amount; break;
                    case CharacterStat.AddVit: vit += amount; break;
                    case CharacterStat.AddInt: intel += amount; break;
                    case CharacterStat.AddDex: dex += amount; break;
                    case CharacterStat.AddLuk: luk += amount; break;
                    case CharacterStat.AddExpPercent: exp += amount; break;
                }

                parts.Add($"{skill.Name} Lv{skill.Level}");
            }

            return new GuildBonusTotals(str, agi, vit, intel, dex, luk, exp,
                parts.Count == 0 ? "" : string.Join("   ·   ", parts));
        }

        /// <summary>
        /// Every boss in the world, and whether this character has met it.
        /// </summary>
        /// <remarks>
        /// A separate errand from the book and drawn as one: no stars, no rank, one line per
        /// boss saying met or not met and how many times. What makes it hard is not the
        /// counting - it is that these respawn once an hour, so the list is a map of evenings
        /// rather than of grinding.
        /// </remarks>
        private float DrawBosses()
        {
            var y = Pad;
            y = BackRow(y, "บันทึกล่าจอมมาร", () => { view = View.Regions; Redraw(); });

            //The prizes first, because they are why anybody opens this page.
            y = BossPrizeRow(y, AdventureBookState.BossPlainHatId, "รางวัล: ล่าครบทุกตัวในบันทึก",
                $"{AdventureBookState.BossFound} / {AdventureBookState.BossTotal} ตัว",
                AdventureBookState.BossCleared);

            //The box, and the hat inside it. Two rows rather than one because they are two
            //different things to go and get, and the hat is not this log's to hand over.
            //Opens the contents rather than the item window, because what somebody wants to
            //know about a box is what comes out of it.
            y = BossPrizeRow(y, AdventureBookState.BossBoxItemId,
                "ดรอปจาก MVP โอกาส 1%  ·  กดดูว่าเปิดแล้วได้อะไรบ้าง",
                $"{AdventureBookState.BoxContents.Count} รายการ", false,
                () => { view = View.Box; Redraw(); });

            y = BossPrizeRow(y, AdventureBookState.BossCrownedHatId, "อยู่ในกล่อง MVP  ·  ไม่มีทางอื่นในเกมนี้",
                "ต้องเปิดกล่องเอา", false);

            y = GroupRow(y, $"MVP  ({AdventureBookState.BossMvpTotal} ตัว)");
            var drawnMini = false;

            foreach (var boss in AdventureBookState.Bosses)
            {
                if (!boss.IsMvp && !drawnMini)
                {
                    drawnMini = true;
                    y = GroupRow(y, $"มินิบอส  ({AdventureBookState.BossTotal - AdventureBookState.BossMvpTotal} ตัว)");
                }

                y = BossRow(y, boss);
            }

            return y + Pad;
        }

        private float BossPrizeRow(float y, int itemId, string what, string state, bool done,
            System.Action onClick = null)
        {
            if (onClick == null && itemId > 0)
                onClick = () => ShowItem(itemId);

            var card = NewCard(y, TallRowHeight, onClick);

            var drawn = DrawItemIcon(card, itemId, new Vector2(12f, -(TallRowHeight - RewardIconSize) / 2f));
            var left = drawn ? 12f + RewardIconSize + 10f : 14f;

            Label(card, ItemName(itemId), left, -8f, 320f, ModernUiTheme.SizeBody,
                done ? DoneColor : ModernUiTheme.NameColor);
            Label(card, what, left, -30f, RewardColumn - left, ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);

            Value(card, state, -12f, -(TallRowHeight - 20f) / 2f, 200f,
                done ? DoneColor : ModernUiTheme.MutedColor);

            return y + TallRowHeight + RowGap;
        }

        /// <summary>
        /// What comes out of the MVP box, and how often.
        /// </summary>
        /// <remarks>
        /// The odds are worked out here from the weights the server sent rather than sent as
        /// percentages, because the table the box is rolled from is a list of weights and a
        /// percentage computed anywhere else is a second number that has to stay right.
        ///
        /// Sorted by weight, so the thing somebody is actually hoping for is at the bottom
        /// where the last line of a list is read.
        /// </remarks>
        private float DrawBox()
        {
            var y = Pad;
            y = BackRow(y, ItemName(AdventureBookState.BossBoxItemId), () => { view = View.Bosses; Redraw(); });

            var note = NewCard(y, TallRowHeight, null);
            Label(note, "เปิดได้ 1 ชิ้นต่อกล่อง สุ่มตามอัตราด้านล่าง", 12f, -8f, RowWidth - 24f,
                ModernUiTheme.SizeBody, ModernUiTheme.NameColor);
            Label(note, "ทุกชิ้นในกล่องนี้ ไม่มีมอนตัวไหนดรอปและไม่มี NPC ตัวไหนขาย", 12f, -30f,
                RowWidth - 24f, ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);
            y += TallRowHeight + RowGap;

            var total = AdventureBookState.BoxWeightTotal;
            if (total <= 0)
                return y + Pad;

            //Rarest last. The list is sent commonest first and read the other way round.
            for (var i = AdventureBookState.BoxContents.Count - 1; i >= 0; i--)
                y = BoxRow(y, AdventureBookState.BoxContents[i], total);

            return y + Pad;
        }

        private float BoxRow(float y, BoxEntry entry, int total)
        {
            var id = entry.ItemId;
            var card = NewCard(y, RowHeight, () => ShowItem(id));

            var drawn = DrawItemIcon(card, id, new Vector2(10f, -(RowHeight - RewardIconSize) / 2f));
            var left = drawn ? 10f + RewardIconSize + 10f : 12f;

            var share = entry.Weight * 100f / total;
            Label(card, ItemName(id), left, -(RowHeight - 20f) / 2f, RewardColumn - left,
                ModernUiTheme.SizeBody,
                share < 10f ? DoneColor : ModernUiTheme.NameColor);

            //Two decimals below one percent, because "0%" beside the thing everybody wants
            //reads as impossible rather than as rare.
            Value(card, share < 1f ? $"{share:0.00}%" : $"{share:0.#}%",
                -12f, -(RowHeight - 20f) / 2f, 120f,
                share < 10f ? DoneColor : ModernUiTheme.MutedColor);

            return y + RowHeight + RowGap;
        }

        private float BossRow(float y, BossLogPage boss)
        {
            var card = NewCard(y, RowHeight, null);

            var star = ModernUiTheme.CreateIcon(card, ModernUiIcons.Star,
                boss.Found ? EarnedColor : UnearnedColor, StarSize);
            ModernUiTheme.Place((RectTransform)star.transform, new Vector2(0, 1),
                new Vector2(12f, -(RowHeight - StarSize) / 2f), new Vector2(StarSize, StarSize));

            var left = 12f + StarSize + 10f;
            Label(card, boss.Name, left, -6f, 240f, ModernUiTheme.SizeBody,
                boss.Found ? DoneColor : ModernUiTheme.NameColor);

            var where = boss.Maps == null || boss.Maps.Count == 0 ? "-" : string.Join(", ", boss.Maps);
            Label(card, $"Lv {boss.Level}   ·   {where}", left, -25f, RewardColumn - left,
                ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor);

            Value(card, boss.Found ? $"ล่าแล้ว {boss.Kills:N0} ครั้ง" : "ยังไม่เคยล่า",
                -12f, -(RowHeight - 20f) / 2f, 200f,
                boss.Found ? DoneColor : ModernUiTheme.MutedColor);

            return y + RowHeight + RowGap;
        }

        /// <summary>
        /// What the book is for, in the window rather than in a wiki nobody has written.
        /// </summary>
        private float DrawHelp()
        {
            var y = Pad;
            y = BackRow(y, "คู่มือนักผจญภัย", () => { view = View.Regions; Redraw(); });

            y = HelpLine(y, "สมุดผจญภัยคืออะไร",
                "บันทึกที่เดินไปเองระหว่างเล่นปกติ ไม่ต้องกดรับเควส ตีมอนไปเรื่อย ๆ แล้ววันหนึ่งเปิดมาก็เสร็จแล้ว");
            y = HelpLine(y, "1 หน้า = การ์ด 1 ใบ",
                "มอนที่ดรอปการ์ดใบเดียวกันนับเป็นหน้าเดียว เช่น ก็อบลินทุกแบบใช้ Goblin Card เหมือนกัน");
            y = HelpLine(y, "ดาว 1 และ ดาว 2",
                "กำจัดให้ครบตามจำนวน จำนวนไม่เท่ากันทุกตัว มอนที่หายากต้องการน้อยกว่า");
            y = HelpLine(y, "ดาว 3",
                "ต้องเก็บการ์ดที่มอนตัวนั้นดรอปด้วยตัวเอง ระบบบันทึกให้ตอนเก็บขึ้นมา และไม่ยึดการ์ดไป การ์ดที่ซื้อ แลก หรือเปิดจาก Old Card Album ไม่นับ");
            y = HelpLine(y, "รางวัลประจำเมือง",
                "ทำครบทุกหน้าในเมืองนั้น ได้หมวกที่หาจากที่อื่นไม่ได้เลยสักทาง");
            y = HelpLine(y, "Adventure Rank",
                "สะสมดาวรวมทั้งเล่ม เพิ่มสเตตัส อัตราดรอป EXP และอัตราตีบวกแบบถาวร ทุกระดับมีของรางวัลให้ด้วย");
            y = HelpLine(y, "วาร์ปไปที่แมพ",
                "ได้ดาว 1 ของมอนตัวไหนแล้ว วาร์ปไปหามันได้จากในสมุด เสีย Zeny ตามระดับ พอถึง Rank 5 ฟรี");
            y = HelpLine(y, "สถานะรวม",
                "หน้าแรกมีปุ่มดูสเตตัสรวม บอกว่าโบนัสแต่ละอย่างมาจาก Adventure กิลด์ หรืออุปกรณ์");
            if (AdventureBookState.HasBossLog)
                y = HelpLine(y, "บันทึกล่าจอมมาร",
                    "คนละเล่มกับสมุด ไม่นับดาว ล่า MVP และมินิบอสให้ครบทุกตัว ได้ Hat of the Sun God ส่วนใบเจาะรูอยู่ในกล่อง MVP อย่างเดียว");

            y = HelpLine(y, "พิมพ์ในแชทก็ได้",
                "!book ดูสรุป  ·  !book <ชื่อมอน> ดูตัวเดียว");

            return y + Pad;
        }

        private float HelpLine(float y, string title, string text)
        {
            var card = NewCard(y, TallRowHeight, null);
            Label(card, title, 12f, -8f, RowWidth - 24f, ModernUiTheme.SizeBody, ModernUiTheme.NameColor);

            var body = ModernUiTheme.CreateText(card, "Body", text, ModernUiTheme.SizeSmall,
                ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Place(body.rectTransform, new Vector2(0, 1), new Vector2(12f, -28f),
                new Vector2(RowWidth - 24f, 26f));

            return y + TallRowHeight + RowGap;
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

        /// <summary>
        /// The row back out of wherever this is, with the theme's own chevron rather than a
        /// less-than sign - the interface font has no arrow in it, and the sign was standing
        /// in for one.
        /// </summary>
        private float BackRow(float y, string title, System.Action onBack)
        {
            var card = NewCard(y, RowHeight, onBack);

            var chevron = ModernUiTheme.CreateIcon(card, ModernUiIcons.ChevronLeft, ModernUiTheme.AccentInkColor, ChevronSize);
            ModernUiTheme.Place((RectTransform)chevron.transform, new Vector2(0, 1),
                new Vector2(12f, -(RowHeight - ChevronSize) / 2f), new Vector2(ChevronSize, ChevronSize));

            Label(card, "ย้อนกลับ", 12f + ChevronSize + 6f, -(RowHeight - 20f) / 2f, 200f,
                ModernUiTheme.SizeBody, ModernUiTheme.AccentInkColor);
            Value(card, title, -12f, -(RowHeight - 20f) / 2f, 320f, ModernUiTheme.LabelColor);
            return y + RowHeight + RowGap;
        }

        /// <summary>
        /// An empty row, banded, and a button when it leads somewhere.
        /// </summary>
        /// <remarks>
        /// The whole row is the button rather than a small arrow at the end. This is read on a
        /// phone as often as on a desktop, and a thumb is not a mouse pointer.
        /// </remarks>
        /// <summary>
        /// One of the things this window does, as against one of the places it lists.
        /// </summary>
        /// <remarks>
        /// Drawn differently on purpose. These four were the same card in the same colour as
        /// the twenty-eight regions under them, so the only thing marking them out was being
        /// at the top - which is not a mark at all once the list has been scrolled. An accent
        /// panel, a badge with a symbol on it and a chevron saying it opens are what say
        /// "this is a button" without needing a word for it.
        /// </remarks>
        private float MenuRow(float y, Sprite icon, string title, string value, System.Action onClick)
        {
            const float height = 46f;
            const float badge = 30f;

            var card = ModernUiTheme.CreateCard(body, "MenuRow", MenuRowColor);
            ModernUiTheme.Place(card, new Vector2(0, 1), new Vector2(Pad, -y), new Vector2(RowWidth, height));

            var image = card.GetComponent<Image>();
            image.raycastTarget = true;
            var button = card.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(() => onClick());
            rows.Add(card.gameObject);

            var badgeRect = ModernUiTheme.CreateCard(card, "Badge", ModernUiTheme.AccentColor);
            ModernUiTheme.Place(badgeRect, new Vector2(0, 1), new Vector2(9f, -(height - badge) / 2f),
                new Vector2(badge, badge));
            badgeRect.GetComponent<Image>().raycastTarget = false;
            ModernUiTheme.CreateIcon(badgeRect, icon, ModernUiTheme.AccentTextColor, 17f);

            var label = ModernUiTheme.CreateText(card, "Title", title, ModernUiTheme.SizeBody,
                ModernUiTheme.TitleColor, TextAlignmentOptions.Left, FontStyles.Bold);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            label.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(label.rectTransform, new Vector2(0, 1), new Vector2(48f, -(height - 20f) / 2f),
                new Vector2(280f, 20f));

            if (!string.IsNullOrEmpty(value))
                Value(card, value, -30f, -(height - 20f) / 2f, 200f, ModernUiTheme.AccentInkColor);

            var chevron = ModernUiTheme.CreateIcon(card, ModernUiIcons.ChevronRight,
                ModernUiTheme.AccentInkColor, ChevronSize);
            ModernUiTheme.Place((RectTransform)chevron.transform, new Vector2(1, 1),
                new Vector2(-10f, -(height - ChevronSize) / 2f), new Vector2(ChevronSize, ChevronSize));

            return y + height + RowGap;
        }

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
        private static bool DrawItemIcon(RectTransform card, int itemId, Vector2 position, float size = RewardIconSize)
        {
            if (itemId <= 0 || ClientDataLoader.Instance == null)
                return false;
            if (!ClientDataLoader.Instance.TryGetItemById(itemId, out var data) || data == null)
                return false;

            var sprite = ClientDataLoader.Instance.GetIconAtlasSprite(data.Sprite);
            if (sprite == null)
                return false;

            var icon = ModernUiTheme.CreateIcon(card, sprite, Color.white, size);
            ModernUiTheme.Place((RectTransform)icon.transform, new Vector2(0, 1), position, new Vector2(size, size));
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
