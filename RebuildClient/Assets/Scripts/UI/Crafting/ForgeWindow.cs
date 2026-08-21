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
        private const float Width = 520f;
        private const float Height = 440f;
        private const float Pad = 8f;

        private const float RowHeight = 58f;
        private const float RowGap = 4f;

        /// <summary>The line under the list that says how the last attempt went.</summary>
        private const float NoteHeight = 24f;

        /// <summary>Where the list starts, clear of the title bar.</summary>
        private const float BodyTop = ModernUiTheme.TitleBarHeight + 2f;

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
        private TextMeshProUGUI note;
        private readonly List<GameObject> rows = new List<GameObject>();

        private int drawnRevision = -1;

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

            //A sunken tray, which is also what catches the drag that scrolls it: the gaps
            //between the rows would otherwise pass the pointer straight through.
            var viewport = ModernUiTheme.CreateCard(rect, "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Stretch(viewport, Pad, Pad + NoteHeight, -Pad, -BodyTop);
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

        private void Redraw()
        {
            drawnRevision = ForgeState.Revision;

            foreach (var row in rows)
                if (row != null)
                    Destroy(row);
            rows.Clear();

            PaintTitle();
            PaintNote();

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
        /// The title bar's second line, which says which skill is open.
        ///
        /// The bar is built with a placeholder subtitle so that this child exists at all -
        /// CreateTitleBar only makes one when it is given something to put in it.
        /// </summary>
        private void PaintTitle()
        {
            var subtitle = transform.Find("ModernTitleBar/Subtitle");
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

            var materials = ModernUiTheme.CreateText(card, "Materials", MaterialsText(recipe, out var enough),
                ModernUiTheme.SizeSmall, ModernUiTheme.LabelColor, TextAlignmentOptions.TopLeft);
            materials.textWrappingMode = TextWrappingModes.NoWrap;
            materials.overflowMode = TextOverflowModes.Ellipsis;
            materials.richText = true;
            ModernUiTheme.Place(materials.rectTransform, new Vector2(0, 1),
                new Vector2(TextInset, -30f), new Vector2(LabelWidth, 18f));

            //Shown to one decimal because that is the resolution the server sends, and
            //because on the hard recipes whole percent would read as the same number for
            //every blacksmith who ever tried them.
            var odds = ModernUiTheme.CreateText(card, "Odds", $"{recipe.Chance / 100f:0.0}%",
                ModernUiTheme.SizeBody, ChanceColor(recipe.Chance), TextAlignmentOptions.TopRight,
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
            button.onClick.AddListener(() => Make(id));
        }

        /// <summary>
        /// What a recipe eats, with anything the player is short of marked.
        ///
        /// The counts are read out of the local bag, which is the same bag the server is
        /// about to check - if the two disagree the button is only wrong about being grey,
        /// and the answer that comes back is still the truth.
        /// </summary>
        private static string MaterialsText(ForgeRecipe recipe, out bool enough)
        {
            enough = true;

            var loader = ClientDataLoader.Instance;
            var inventory = PlayerState.Instance != null ? PlayerState.Instance.Inventory : null;
            var text = "";

            foreach (var material in recipe.Materials)
            {
                var data = loader != null ? loader.GetItemById(material.ItemId) : null;
                var name = data != null ? data.Name : material.ItemId.ToString();
                var onHand = inventory != null ? inventory.CountItemByItemId(material.ItemId) : 0;

                if (text.Length > 0)
                    text += "  ·  ";

                if (onHand < material.Count)
                {
                    enough = false;
                    text += $"<color=#A53E18>{name} {onHand}/{material.Count}</color>";
                }
                else
                    text += $"{name} {onHand}/{material.Count}";
            }

            return text;
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

        private void Make(int resultId)
        {
            var net = NetworkManager.Instance;
            if (net == null)
                return;

            net.SendCraftRequest(ForgeState.Skill, resultId);

            //Asked for again straight after, because the answer to an attempt says how it
            //went and not what is left in the bag - the counts on the rows have to come
            //back from somewhere.
            net.SendCraftListRequest(ForgeState.Skill);
        }
    }
}
