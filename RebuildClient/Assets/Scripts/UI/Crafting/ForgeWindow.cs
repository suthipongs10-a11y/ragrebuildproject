using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Crafting
{
    /// <summary>
    /// The forge: what the pressed crafting skill can make, and one button per thing.
    ///
    /// Nothing here decides anything. The recipes, what they cost and the odds on each all
    /// came off the wire, and the button only asks - the server checks the whole thing
    /// again and rolls. What the window is for is telling the player what they are about
    /// to spend and what their chances are before they spend it.
    ///
    /// One window for all four skills rather than four: they are the same list with
    /// different rows in it, and the title says which one is open.
    ///
    /// Laid out by hand for the same reason the market is: the list is of unknown length,
    /// and a layout group with a size fitter leaves the rect it drives at zero height
    /// until a layout pass has run on an active object.
    /// </summary>
    public class ForgeWindow : WindowBase
    {
        private const float Width = 664f;
        private const float Height = 470f;
        private const float Pad = 8f;

        private const float RowHeight = 58f;
        private const float RowGap = 4f;

        /// <summary>The line under the list that says how the last attempt went.</summary>
        private const float NoteHeight = 24f;

        /// <summary>Where the list starts on an ore skill, clear of the title bar.</summary>
        private const float BodyTop = ModernUiTheme.TitleBarHeight + 2f;

        /// <summary>The two rows of pickers a weapon skill gets, and where they sit.</summary>
        private const float ToolHeight = 62f;
        private const float PickRowHeight = 26f;
        private const float PickGap = 4f;

        /// <summary>
        /// The column the picker buttons start in, leaving the label to the left of it.
        ///
        /// Wide enough for "ธาตุ (ต้องมี Weapon Binding)", which is the longest thing that
        /// ever goes there, so the buttons never start under their own label.
        /// </summary>
        private const float PickLabelWidth = 176f;

        /// <summary>"ไม่ใส่", which is narrower than a stone's name.</summary>
        private const float NoStoneWidth = 60f;

        /// <summary>
        /// One stone button. "Mystic Frozen" is the longest of the four and wrapped onto two
        /// lines at anything less, which is what pushed "Great Nature" off the window.
        /// </summary>
        private const float StoneWidth = 96f;

        /// <summary>A star crumb count, which is one digit.</summary>
        private const float CrumbWidth = 40f;

        /// <summary>Where the icon sits on a row.</summary>
        private const float IconInset = 10f;

        /// <summary>Where the words start, clear of the icon.</summary>
        private const float TextInset = 58f;

        /// <summary>The button on the right of a row.</summary>
        private const float ActionWidth = 66f;

        /// <summary>The odds and the fee, right aligned against the button.</summary>
        private const float OddsWidth = 96f;

        /// <summary>How wide the words on the left may run before they meet the odds.</summary>
        private const float LabelWidth = Width - TextInset - OddsWidth - ActionWidth - 40f;

        /// <summary>A material the player is short of.</summary>
        private static readonly Color ShortColor = new Color(0.647f, 0.243f, 0.094f);

        /// <summary>Every other row, so a long list reads as rows and not as a wall.</summary>
        private static readonly Color RowAltColor = new Color(0.937f, 0.957f, 0.980f);

        /// <summary>It worked.</summary>
        private static readonly Color GoodColor = new Color(0.106f, 0.412f, 0.208f);

        private static ForgeWindow instance;

        private RectTransform body;
        private RectTransform viewport;
        private RectTransform tools;
        private TextMeshProUGUI note;
        private readonly List<GameObject> rows = new List<GameObject>();

        private int drawnRevision = -1;

        /// <summary>
        /// What is about to go into the next weapon: a stone, or zero for none, and how
        /// many star crumbs.
        ///
        /// Kept for the window rather than per row, because it is one decision - what kind
        /// of weapon am I making today - and every row's odds are shown against it.
        /// </summary>
        private int pickedStone;
        private int pickedCrumbs;

        // =====================================================================
        // Opening

        /// <summary>
        /// Pressing a crafting skill.
        ///
        /// The list is asked for every time rather than kept, because the odds on it are
        /// this character's odds right now - a point of dex or a skill level since the last
        /// time would otherwise leave the window quietly lying about them.
        /// </summary>
        public static void Open(CharacterSkill skill)
        {
            if (instance == null)
                instance = Build();

            if (instance == null)
                return;

            var net = NetworkManager.Instance;
            if (net == null)
                return;

            //Cleared on the ask, not on the answer, so the window cannot briefly draw one
            //skill's recipes under another skill's title.
            ForgeState.Clear();
            ForgeState.Skill = skill;

            //Cleared with the list. Carrying a flame heart over from the last time the
            //window was open would mean spending one without having chosen to.
            instance.pickedStone = 0;
            instance.pickedCrumbs = 0;

            instance.gameObject.SetActive(true);
            instance.MoveToTop();
            instance.FitWindowIntoPlayArea();
            instance.Redraw();

            net.SendCraftListRequest(skill);
        }

        public static void Toggle(CharacterSkill skill)
        {
            if (instance != null && instance.gameObject.activeSelf && ForgeState.Skill == skill)
            {
                instance.CloseWindow();
                return;
            }

            Open(skill);
        }

        private static ForgeWindow Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            //assembled inactive so nothing runs against a half built window
            var host = new GameObject("ForgeWindow", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<ForgeWindow>();
            window.CanCloseWithEscape = true;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, "ตีเหล็ก", " ", ModernUiIcons.Spark);
            ModernUiTheme.AttachShadow(rect);

            window.tools = ModernUiTheme.CreateRect("Tools", rect);
            ModernUiTheme.Place(window.tools, new Vector2(0, 1), new Vector2(Pad, -BodyTop),
                new Vector2(Width - Pad * 2f, ToolHeight));

            //A sunken tray, which is also what catches the drag that scrolls it: the gaps
            //between the rows would otherwise pass the pointer straight through.
            var viewport = ModernUiTheme.CreateCard(rect, "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Stretch(viewport, Pad, Pad + NoteHeight, -Pad, -BodyTop);
            viewport.gameObject.AddComponent<RectMask2D>();
            window.viewport = viewport;

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

            window.note = ModernUiTheme.CreateText(rect, "Note", "", ModernUiTheme.SizeSmall,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            window.note.textWrappingMode = TextWrappingModes.NoWrap;
            window.note.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(window.note.rectTransform, new Vector2(0, 0),
                new Vector2(Pad + 4f, Pad - 2f), new Vector2(Width - Pad * 2f - 8f, NoteHeight - 4f));

            host.SetActive(true);
            return window;
        }

        // =====================================================================
        // Noticing the answer

        private void Update()
        {
            if (drawnRevision != ForgeState.Revision)
                Redraw();
        }

        // =====================================================================
        // Drawing

        /// <summary>
        /// Whether what is open takes sockets.
        ///
        /// Read off the recipes rather than the skill, so the pickers can only appear over
        /// a list that has something to put them in.
        /// </summary>
        private bool HasSockets
        {
            get
            {
                foreach (var recipe in ForgeState.Recipes)
                    if (recipe.IsWeapon)
                        return true;
                return false;
            }
        }

        private void Redraw()
        {
            drawnRevision = ForgeState.Revision;

            foreach (var row in rows)
                if (row != null)
                    Destroy(row);
            rows.Clear();

            for (var i = tools.childCount - 1; i >= 0; i--)
                Destroy(tools.GetChild(i).gameObject);

            PaintTitle();
            PaintNote();

            //The tray starts under the pickers when there are any, and under the title bar
            //when there are not - an ore list would otherwise open with a strip of nothing.
            var sockets = HasSockets;
            tools.gameObject.SetActive(sockets);
            ModernUiTheme.Stretch(viewport, Pad, Pad + NoteHeight, -Pad,
                -(sockets ? BodyTop + ToolHeight : BodyTop));

            if (sockets)
                BuildPickers();

            if (!ForgeState.Received)
            {
                BuildNote("กำลังโหลด...", -RowGap);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            if (ForgeState.Recipes.Count == 0)
            {
                BuildNote("ยังทำอะไรไม่ได้ ต้องเพิ่มเลเวลสกิลก่อน", -RowGap);
                body.sizeDelta = new Vector2(0, RowHeight);
                return;
            }

            var y = -RowGap;
            for (var i = 0; i < ForgeState.Recipes.Count; i++)
            {
                BuildRow(ForgeState.Recipes[i], i, y);
                y -= RowHeight + RowGap;
            }

            body.sizeDelta = new Vector2(0, -y);
        }

        /// <summary>
        /// The two rows above the list: which stone goes in, and how many star crumbs.
        ///
        /// One setting for the window rather than one per weapon. Picking a stone is a
        /// decision about what you are making today, and every row's odds redraw against
        /// it, so the cost of the choice is visible before anything is spent.
        /// </summary>
        private void BuildPickers()
        {
            var loader = ClientDataLoader.Instance;

            var elementLabel = ModernUiTheme.CreateText(tools, "ElementLabel",
                ForgeState.CanBindElement ? "ธาตุ" : "ธาตุ (ต้องมี Weapon Binding)",
                ModernUiTheme.SizeSmall, ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            elementLabel.textWrappingMode = TextWrappingModes.NoWrap;
            elementLabel.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(elementLabel.rectTransform, new Vector2(0, 1),
                new Vector2(0f, 0f), new Vector2(PickLabelWidth - PickGap, PickRowHeight));

            var x = PickLabelWidth;
            AddPick(0f, "ไม่ใส่", pickedStone == 0, true, () => { pickedStone = 0; Redraw(); },
                NoStoneWidth, ref x);

            foreach (var stone in ForgeState.Stones)
            {
                var data = loader != null ? loader.GetItemById(stone) : null;
                var name = data != null ? data.Name : stone.ToString();
                var id = stone;
                AddPick(0f, name, pickedStone == id, ForgeState.CanBindElement,
                    () => { pickedStone = id; Redraw(); }, StoneWidth, ref x);
            }

            var crumbLabel = ModernUiTheme.CreateText(tools, "CrumbLabel", "Star Crumb",
                ModernUiTheme.SizeSmall, ModernUiTheme.LabelColor, TextAlignmentOptions.Left);
            crumbLabel.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(crumbLabel.rectTransform, new Vector2(0, 1),
                new Vector2(0f, -(PickRowHeight + PickGap)), new Vector2(PickLabelWidth - PickGap, PickRowHeight));

            var crumbX = PickLabelWidth;
            for (var i = 0; i <= ForgeState.MaxStarCrumbs; i++)
            {
                var count = i;
                AddPick(-(PickRowHeight + PickGap), count.ToString(), pickedCrumbs == count, true,
                    () => { pickedCrumbs = count; Redraw(); }, CrumbWidth, ref crumbX);
            }

            //All three, not just the third. The jump at three is the interesting one, but a
            //player weighing one crumb against the odds it costs needs the other two numbers
            //to weigh it against, and the name is spelled out so the row says what it is
            //buying rather than only how much.
            var hint = ModernUiTheme.CreateText(tools, "CrumbHint",
                "Star Crumb  1 = ATK+5  ·  2 = +10  ·  3 = +40",
                ModernUiTheme.SizeSmall, ModernUiTheme.MutedColor, TextAlignmentOptions.Left);
            hint.textWrappingMode = TextWrappingModes.NoWrap;
            hint.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(hint.rectTransform, new Vector2(0, 1),
                new Vector2(crumbX + 10f, -(PickRowHeight + PickGap)),
                new Vector2(Width - Pad * 2f - crumbX - 12f, PickRowHeight));
        }

        /// <summary>One button on a picker row, laid out left to right as they are added.</summary>
        private void AddPick(float y, string label, bool active, bool usable, UnityEngine.Events.UnityAction onClick,
            float width, ref float x)
        {
            var button = ModernUiTheme.CreateButton(tools, "Pick" + label,
                label, active ? ModernUiTheme.AccentColor : ModernUiTheme.CardColor,
                active ? ModernUiTheme.AccentTextColor : ModernUiTheme.NameColor,
                ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 1),
                new Vector2(x, y), new Vector2(width, PickRowHeight));
            button.interactable = usable;
            button.onClick.AddListener(onClick);
            x += width + PickGap;
        }

        /// <summary>
        /// What the window is called, which is whatever the pressed skill makes.
        ///
        /// One window serves six skills, so a fixed title said "ตีเหล็ก" over a list of
        /// spears. The skill's own English name goes on the second line underneath.
        /// </summary>
        private static string TitleFor(CharacterSkill skill)
        {
            switch (skill)
            {
                case CharacterSkill.IronTempering: return "ถลุงเหล็ก";
                case CharacterSkill.SteelTempering: return "ถลุงเหล็กกล้า";
                case CharacterSkill.EnchantedStoneCraft: return "คราฟหินธาตุ";
                case CharacterSkill.SmithBladeWeapon: return "ตีดาบ มีด";
                case CharacterSkill.SmithBluntWeapon: return "ตีกระบอง ขวาน";
                case CharacterSkill.SmithPiercingWeapon: return "ตีหอก";
                default: return "ตีเหล็ก";
            }
        }

        /// <summary>
        /// The two lines in the title bar: what is being made, and which skill makes it.
        ///
        /// The bar is built with a placeholder subtitle so that child exists at all -
        /// CreateTitleBar only makes one when it is given something to put in it.
        /// </summary>
        private void PaintTitle()
        {
            var bar = transform.Find("ModernTitleBar");
            if (bar == null)
                return;

            var title = bar.Find("Title");
            if (title != null)
            {
                var titleText = title.GetComponent<TextMeshProUGUI>();
                if (titleText != null)
                    titleText.text = TitleFor(ForgeState.Skill);
            }

            var subtitle = bar.Find("Subtitle");
            if (subtitle == null)
                return;

            var text = subtitle.GetComponent<TextMeshProUGUI>();
            if (text == null)
                return;

            //GetSkillName rather than GetSkillData, which indexes and would throw on a
            //skill the client's data does not have.
            var loader = ClientDataLoader.Instance;
            text.text = loader != null ? loader.GetSkillName(ForgeState.Skill) : "";
        }

        /// <summary>How the last attempt went, in a line that stays until the next one.</summary>
        private void PaintNote()
        {
            if (note == null)
                return;

            if (!ForgeState.HasResult)
            {
                note.text = "";
                return;
            }

            var loader = ClientDataLoader.Instance;
            var data = loader != null ? loader.GetItemById(ForgeState.LastResultItem) : null;
            var name = data != null ? data.Name : "ของ";

            switch (ForgeState.LastResult)
            {
                case CraftResult.Success:
                    note.color = GoodColor;
                    note.text = ForgeState.LastResultCount > 1
                        ? $"สำเร็จ ได้ {name} x{ForgeState.LastResultCount}"
                        : $"สำเร็จ ได้ {name}";
                    break;
                case CraftResult.Failed:
                    note.color = ShortColor;
                    note.text = $"ล้มเหลว {name} พัง วัตถุดิบหายไปแล้ว";
                    break;
                case CraftResult.MissingMaterials:
                    note.color = ShortColor;
                    note.text = "วัตถุดิบไม่พอ";
                    break;
                case CraftResult.NotEnoughZeny:
                    note.color = ShortColor;
                    note.text = "เงินไม่พอ";
                    break;
                case CraftResult.SkillTooLow:
                    note.color = ShortColor;
                    note.text = "เลเวลสกิลไม่พอ";
                    break;
                case CraftResult.BagFull:
                    note.color = ShortColor;
                    note.text = "กระเป๋าเต็มหรือน้ำหนักเกิน";
                    break;
                case CraftResult.CannotBindElement:
                    note.color = ShortColor;
                    note.text = "ใส่ธาตุไม่ได้ ต้องมีสกิล Weapon Binding ก่อน";
                    break;
                default:
                    note.color = ShortColor;
                    note.text = "ทำไม่ได้";
                    break;
            }
        }

        private void BuildNote(string message, float y)
        {
            var text = ModernUiTheme.CreateText(body, "Empty", message, ModernUiTheme.SizeLabel,
                ModernUiTheme.LabelColor, TextAlignmentOptions.Center);
            text.rectTransform.anchorMin = new Vector2(0, 1);
            text.rectTransform.anchorMax = new Vector2(1, 1);
            text.rectTransform.pivot = new Vector2(0.5f, 1);
            text.rectTransform.sizeDelta = new Vector2(0, RowHeight);
            text.rectTransform.anchoredPosition = new Vector2(0, y);
            rows.Add(text.gameObject);
        }

        private void BuildRow(ForgeRecipe recipe, int index, float y)
        {
            var card = ModernUiTheme.CreateCard(body, "Row" + index,
                index % 2 == 0 ? Color.white : RowAltColor);
            card.anchorMin = new Vector2(0, 1);
            card.anchorMax = new Vector2(1, 1);
            card.pivot = new Vector2(0.5f, 1);
            card.sizeDelta = new Vector2(-RowGap * 2f, RowHeight);
            card.anchoredPosition = new Vector2(0, y);
            card.GetComponent<Image>().raycastTarget = false;
            rows.Add(card.gameObject);

            var loader = ClientDataLoader.Instance;
            var data = loader != null ? loader.GetItemById(recipe.ResultId) : null;

            var icon = IconFor(data);
            if (icon != null)
            {
                var image = ModernUiTheme.CreateIcon(card, icon, Color.white, 40f);
                ModernUiTheme.Place(image.rectTransform, new Vector2(0, 0.5f),
                    new Vector2(IconInset, 0f), new Vector2(40f, 40f));
            }

            var title = data != null ? data.Name : recipe.ResultId.ToString();
            if (recipe.ResultCount > 1)
                title += $" x{recipe.ResultCount}";

            var name = ModernUiTheme.CreateText(card, "Name", title, ModernUiTheme.SizeBody,
                ModernUiTheme.TitleColor, TextAlignmentOptions.TopLeft, FontStyles.Bold);
            name.textWrappingMode = TextWrappingModes.NoWrap;
            name.overflowMode = TextOverflowModes.Ellipsis;
            ModernUiTheme.Place(name.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -8f), new Vector2(LabelWidth, 20f));

            var materials = ModernUiTheme.CreateText(card, "Materials", MaterialsText(recipe, StoneFor(recipe), CrumbsFor(recipe), out var enough),
                ModernUiTheme.SizeSmall, ModernUiTheme.LabelColor, TextAlignmentOptions.TopLeft);
            materials.textWrappingMode = TextWrappingModes.NoWrap;
            materials.overflowMode = TextOverflowModes.Ellipsis;
            materials.richText = true;
            ModernUiTheme.Place(materials.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -30f), new Vector2(LabelWidth, 18f));

            //Shown to one decimal because that is the resolution the server sends, and
            //because on the hard recipes whole percent would read as the same number for
            //every blacksmith who ever tried them.
            var chance = recipe.ChanceWith(StoneFor(recipe) > 0, CrumbsFor(recipe));
            var odds = ModernUiTheme.CreateText(card, "Odds", $"{chance / 100f:0.0}%",
                ModernUiTheme.SizeBody, ChanceColor(chance), TextAlignmentOptions.TopRight,
                FontStyles.Bold);
            odds.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(odds.rectTransform, new Vector2(1, 1),
                new Vector2(-(ActionWidth + 14f), -8f), new Vector2(OddsWidth, 20f));

            var affordable = PlayerState.Instance == null || PlayerState.Instance.Zeny >= recipe.Zeny;
            var fee = ModernUiTheme.CreateText(card, "Fee",
                recipe.Zeny > 0 ? $"{recipe.Zeny:N0}z" : "ฟรี", ModernUiTheme.SizeSmall,
                affordable ? ModernUiTheme.LabelColor : ShortColor, TextAlignmentOptions.TopRight);
            fee.textWrappingMode = TextWrappingModes.NoWrap;
            ModernUiTheme.Place(fee.rectTransform, new Vector2(1, 1),
                new Vector2(-(ActionWidth + 14f), -30f), new Vector2(OddsWidth, 16f));

            var ready = enough && affordable;
            var button = ModernUiTheme.CreateButton(card, "Make", "ตี",
                ready ? ModernUiTheme.AccentColor : ModernUiTheme.CardDeepColor,
                ready ? ModernUiTheme.AccentTextColor : ModernUiTheme.MutedColor,
                ModernUiTheme.SizeLabel);
            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(1, 0.5f),
                new Vector2(-10f, 0f), new Vector2(ActionWidth, 32f));
            button.interactable = ready;

            var id = recipe.ResultId;
            var stone = StoneFor(recipe);
            var crumbs = CrumbsFor(recipe);
            button.onClick.AddListener(() => Make(id, stone, crumbs));
        }

        /// <summary>What would go into this one, which is nothing at all unless it is a weapon.</summary>
        private int StoneFor(ForgeRecipe recipe) =>
            recipe.IsWeapon && ForgeState.CanBindElement ? pickedStone : 0;

        private int CrumbsFor(ForgeRecipe recipe) => recipe.IsWeapon ? pickedCrumbs : 0;

        /// <summary>
        /// What a recipe eats, with anything the player is short of marked.
        ///
        /// The counts are read out of the local bag, which is the same bag the server is
        /// about to check - if the two disagree the button is only wrong about being grey,
        /// and the answer that comes back is still the truth.
        /// </summary>
        private static string MaterialsText(ForgeRecipe recipe, int stone, int crumbs, out bool enough)
        {
            var text = "";
            var missing = false;

            foreach (var material in recipe.Materials)
                Append(material.ItemId, material.Count);

            //What is being bound in is spent exactly like a material, so it belongs on the
            //same line - a stone that is short should look the same as an ore that is.
            if (stone > 0)
                Append(stone, 1);

            if (crumbs > 0 && ForgeState.StarCrumbId > 0)
                Append(ForgeState.StarCrumbId, crumbs);

            enough = !missing;
            return text;

            void Append(int itemId, int count)
            {
                var loader = ClientDataLoader.Instance;
                var inventory = PlayerState.Instance != null ? PlayerState.Instance.Inventory : null;
                var data = loader != null ? loader.GetItemById(itemId) : null;
                var name = data != null ? data.Name : itemId.ToString();
                var onHand = inventory != null ? inventory.CountItemByItemId(itemId) : 0;

                if (text.Length > 0)
                    text += "  ·  ";

                if (onHand < count)
                {
                    missing = true;
                    text += $"<color=#A53E18>{name} {onHand}/{count}</color>";
                }
                else
                    text += $"{name} {onHand}/{count}";
            }
        }

        /// <summary>Green when it is a sure thing, red when it is mostly a donation.</summary>
        private static Color ChanceColor(int chance)
        {
            if (chance >= ForgeChanceScale)
                return GoodColor;
            if (chance < ForgeChanceScale / 4)
                return ShortColor;
            return ModernUiTheme.NameColor;
        }

        /// <summary>
        /// The same scale the server sends odds on.
        ///
        /// Named here rather than reached for through the server's own constant because the
        /// client does not have that assembly - if one side ever changes it, this is the
        /// line that has to change with it.
        /// </summary>
        private const int ForgeChanceScale = 10000;

        /// <summary>
        /// An item's icon.
        ///
        /// The atlas is keyed by the sprite name out of the grf, which is Korean; the item
        /// code is tried after it only so a row still shows something if a sprite is
        /// missing from the data.
        /// </summary>
        private static Sprite IconFor(RebuildSharedData.ClientTypes.ItemData data)
        {
            var loader = ClientDataLoader.Instance;
            if (data == null || loader == null)
                return null;

            if (!string.IsNullOrEmpty(data.Sprite))
            {
                var sprite = loader.GetIconAtlasSprite(data.Sprite);
                if (sprite != null)
                    return sprite;
            }

            return string.IsNullOrEmpty(data.Code) ? null : loader.GetIconAtlasSprite(data.Code);
        }

        // =====================================================================
        // Doing something

        private void Make(int resultId, int stone, int crumbs)
        {
            var net = NetworkManager.Instance;
            if (net == null)
                return;

            net.SendCraftRequest(ForgeState.Skill, resultId, stone, crumbs);

            //Asked for again straight after, because the answer to an attempt says how it
            //went and not what is left in the bag - the counts on the rows have to come
            //back from somewhere.
            net.SendCraftListRequest(ForgeState.Skill);
        }
    }
}
