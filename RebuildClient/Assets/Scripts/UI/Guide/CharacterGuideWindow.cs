using System.Collections.Generic;
using Assets.Scripts.PlayerControl;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Guide
{
    /// <summary>
    /// A tab in the character window that says how to play whatever job the player is.
    ///
    /// It reads the job off the player and shows the advice for it: which ways the job can
    /// be built, where the stat points go, which skills in which order, and what to wear at
    /// three levels of wealth. Changing job rebuilds the page, so it is never advice for
    /// somebody else's character.
    ///
    /// Laid out by hand rather than by a layout group. The sections are text of unknown
    /// length and a group with a size fitter leaves the rect it drives at zero height until
    /// a layout pass has run on an active object, which has already cost this project one
    /// round of "nothing changed". Asking the label what height it wants and stacking the
    /// cards on that number is a thing that can be reasoned about without running it.
    /// </summary>
    public class CharacterGuideWindow : WindowBase
    {
        private const float Width = 524f;
        private const float Height = 404f;
        private const float Pad = 8f;

        private const float HeaderHeight = 46f;
        private const float ChipHeight = 30f;
        private const float ChipGap = 6f;
        private const float SectionGap = 8f;

        private const float CardPadX = 12f;
        private const float CardPadY = 9f;
        private const float HeadHeight = 19f;
        private const float HeadGap = 3f;

        //the gold of the third tier, the same hue the experience gauge uses, so "rare"
        //reads the same way here as it does everywhere else in this interface
        private static readonly Color RareColor = new Color(0.454f, 0.324f, 0.082f);

        private RectTransform body;
        private TextMeshProUGUI title;
        private RectTransform chipRow;

        private readonly List<Button> chips = new List<Button>();
        private readonly List<Image> chipBorders = new List<Image>();

        private int shownJob = -1;
        private int build;

        public static CharacterGuideWindow Create(RectTransform parent)
        {
            var go = new GameObject("CharacterGuide", typeof(RectTransform));
            go.SetActive(false);
            go.transform.SetParent(parent, false);

            var window = go.AddComponent<CharacterGuideWindow>();
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

            title = ModernUiTheme.CreateText(root, "JobTitle", "", ModernUiTheme.SizeValue,
                ModernUiTheme.TitleColor, TextAlignmentOptions.TopLeft, FontStyles.Bold);
            ModernUiTheme.Place(title.rectTransform, new Vector2(0, 1), new Vector2(Pad + 2f, -2f),
                new Vector2(Width - Pad * 2f - 4f, HeaderHeight));

            chipRow = ModernUiTheme.CreateRect("Builds", root);
            ModernUiTheme.Place(chipRow, new Vector2(0, 1), new Vector2(Pad, -HeaderHeight),
                new Vector2(Width - Pad * 2f, ChipHeight));

            //A sunken tray, which is also what catches the drag that scrolls it: the gaps
            //between the cards would otherwise pass the pointer straight through.
            var viewport = ModernUiTheme.CreateCard(transform, "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Stretch(viewport, Pad, Pad, -Pad, -(HeaderHeight + ChipHeight + 6f));
            viewport.gameObject.AddComponent<RectMask2D>();

            body = ModernUiTheme.CreateRect("Sections", viewport);
            body.anchorMin = new Vector2(0, 1);
            body.anchorMax = new Vector2(1, 1);
            body.pivot = new Vector2(0.5f, 1);
            body.offsetMin = new Vector2(0, 0);
            body.offsetMax = new Vector2(0, 0);

            var scroll = gameObject.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = body;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 32f;
        }

        /// <summary>
        /// The width a section's text actually gets, which is the tray less the card's own
        /// inner padding. Everything measured here is measured against this number.
        /// </summary>
        private static float TextWidth => Width - Pad * 2f - CardPadX * 2f;

        private void Update()
        {
            var state = PlayerState.Instance;
            if (state == null)
                return;

            if (state.JobId == shownJob)
                return;

            shownJob = state.JobId;
            build = 0;
            BuildChips();
            BuildSections();
        }

        private void BuildChips()
        {
            foreach (var chip in chips)
            {
                if (chip == null)
                    continue;

                //Destroy does not take effect until the end of the frame, so the old row
                //would be drawn under the new one for a frame if it were not switched off
                //here as well.
                chip.gameObject.SetActive(false);
                Destroy(chip.gameObject);
            }

            chips.Clear();
            chipBorders.Clear();

            var guide = JobGuideData.For(shownJob);
            title.text = guide != null ? guide.Job : "อาชีพนี้ยังไม่มีคำแนะนำ";

            if (guide == null || guide.Builds == null || guide.Builds.Length == 0)
                return;

            var count = guide.Builds.Length;
            var width = (chipRow.rect.width - ChipGap * (count - 1)) / count;

            for (var i = 0; i < count; i++)
            {
                var chip = ModernUiTheme.CreateButton(chipRow, "Build" + i, guide.Builds[i].Name,
                    ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)chip.transform, new Vector2(0, 1),
                    new Vector2(i * (width + ChipGap), 0), new Vector2(width, ChipHeight));

                chipBorders.Add(ModernUiTheme.AddBorder((RectTransform)chip.transform,
                    ModernUiTheme.CardBorderColor));

                var index = i;
                chip.onClick.AddListener(() =>
                {
                    if (build == index)
                        return;

                    build = index;
                    BuildSections();
                    PaintChips();
                });

                chips.Add(chip);
            }

            PaintChips();
        }

        private void PaintChips()
        {
            for (var i = 0; i < chips.Count; i++)
            {
                var active = i == build;

                var fill = chips[i].GetComponent<Image>();
                if (fill != null)
                    fill.color = active ? ModernUiTheme.AccentColor : ModernUiTheme.CardColor;

                if (i < chipBorders.Count && chipBorders[i] != null)
                    chipBorders[i].color = active ? ModernUiTheme.AccentColor : ModernUiTheme.CardBorderColor;

                var ink = active ? ModernUiTheme.AccentTextColor : ModernUiTheme.NameColor;
                foreach (var label in chips[i].GetComponentsInChildren<TextMeshProUGUI>(true))
                {
                    label.color = ink;
                    label.fontStyle = FontStyles.Bold;
                }
            }
        }

        private void BuildSections()
        {
            //switched off as well as destroyed, because a destroy does not land until the
            //end of the frame and the outgoing cards would otherwise show through the
            //incoming ones for exactly one frame on every tap of a build chip
            for (var i = body.childCount - 1; i >= 0; i--)
            {
                var child = body.GetChild(i).gameObject;
                child.SetActive(false);
                Destroy(child);
            }

            var cursor = -SectionGap;
            var guide = JobGuideData.For(shownJob);

            if (guide == null)
            {
                cursor = AddSection(cursor, "ยังไม่พร้อมเล่น", JobGuideData.NoTreeNote, RareColor);
                Finish(cursor);
                return;
            }

            if (!string.IsNullOrEmpty(guide.Intro))
                cursor = AddSection(cursor, "อาชีพนี้เป็นยังไง", guide.Intro, ModernUiTheme.LabelColor);

            if (guide.Builds == null || guide.Builds.Length == 0)
            {
                Finish(cursor);
                return;
            }

            var chosen = guide.Builds[Mathf.Clamp(build, 0, guide.Builds.Length - 1)];

            cursor = AddSection(cursor, "เหมาะกับ", chosen.Suits, ModernUiTheme.AccentInkColor);
            cursor = AddSection(cursor, "ลงสเตตัสยังไง", chosen.Stats, ModernUiTheme.AccentInkColor);
            cursor = AddSection(cursor, "อัพสกิลตามลำดับนี้", chosen.Skills, ModernUiTheme.AccentInkColor);
            cursor = AddSection(cursor, "ของสวมใส่ · ระดับ 1 — ของหาง่าย",
                chosen.GearEarly, ModernUiTheme.LabelColor);
            cursor = AddSection(cursor, "ของสวมใส่ · ระดับ 2 — เริ่มมีเงิน",
                chosen.GearMid, ModernUiTheme.AccentInkColor);
            cursor = AddSection(cursor, "ของสวมใส่ · ระดับ 3 — ของหายาก / ของบอส",
                chosen.GearLate, RareColor);
            cursor = AddSection(cursor, "การ์ดแนะนำ", chosen.Cards, ModernUiTheme.AccentInkColor);
            cursor = AddSection(cursor, "อ่านตารางระดับของยังไง", JobGuideData.GeneralNote,
                ModernUiTheme.MutedColor);

            Finish(cursor);
        }

        /// <summary>
        /// One card, sized to the text it holds, hung under the one before it. Returns the
        /// cursor for the next card.
        /// </summary>
        private float AddSection(float cursor, string head, string content, Color headColor)
        {
            var card = ModernUiTheme.CreateCard(body, "Section", ModernUiTheme.CardColor, true);

            var heading = ModernUiTheme.CreateText(card, "Head", head, ModernUiTheme.SizeLabel,
                headColor, TextAlignmentOptions.TopLeft, FontStyles.Bold);
            ModernUiTheme.Place(heading.rectTransform, new Vector2(0, 1),
                new Vector2(CardPadX, -CardPadY), new Vector2(TextWidth, HeadHeight));

            var text = ModernUiTheme.CreateText(card, "Body", content, ModernUiTheme.SizeBody,
                ModernUiTheme.NameColor, TextAlignmentOptions.TopLeft);
            text.textWrappingMode = TextWrappingModes.Normal;

            //Asked for rather than assumed, because these are hand written paragraphs and
            //no two of them are the same number of lines. A couple of points of slack on
            //top: the measurement is of the glyphs, and a Thai line carrying tone marks
            //above and vowels below sits taller than the Latin the number was taken from.
            var textHeight = text.GetPreferredValues(TextWidth, 4000f).y + 4f;
            ModernUiTheme.Place(text.rectTransform, new Vector2(0, 1),
                new Vector2(CardPadX, -(CardPadY + HeadHeight + HeadGap)),
                new Vector2(TextWidth, textHeight));

            var height = CardPadY * 2f + HeadHeight + HeadGap + textHeight;
            ModernUiTheme.Place(card, new Vector2(0, 1), new Vector2(0, cursor),
                new Vector2(Width - Pad * 2f, height));

            return cursor - height - SectionGap;
        }

        private void Finish(float cursor)
        {
            //cursor is negative and runs downward, so the total is how far it travelled
            body.sizeDelta = new Vector2(0, -cursor);
            body.anchoredPosition = Vector2.zero;
        }
    }
}
