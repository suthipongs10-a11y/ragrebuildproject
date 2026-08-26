using System;
using Assets.Scripts.Rendering;
using Assets.Scripts.UI.ConfigWindow;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// Picture quality, as four presets and the switches behind them.
    /// </summary>
    /// <remarks>
    /// Its own window rather than a page of the options window, because that one is built in
    /// the scene and every control on it is a reference somebody wired by hand. Everything
    /// here is drawn from code, the way the market, the forge and the adventure book are.
    ///
    /// Presets first and switches underneath, in that order on purpose. Almost nobody wants
    /// to reason about a shadow map; they want the game to stop stuttering, and one of four
    /// buttons is the whole of that conversation. The switches are for the case the presets
    /// do not cover - a phone that is fine everywhere except a town full of shops, which
    /// wants High with other players hidden and nothing else touched.
    ///
    /// The frame counter is on this window because a setting nobody can measure is a setting
    /// nobody can choose. Turn it on, walk into prontera, and the worst-frame number says
    /// more in ten seconds than an afternoon of guessing.
    /// </remarks>
    public class GraphicsSettingsWindow : WindowBase
    {
        private const float Width = 440f;
        private const float Height = 540f;
        private const float Pad = 12f;
        private const float RowHeight = 52f;
        private const float RowGap = 5f;
        private const float PresetHeight = 40f;
        private const float ControlWidth = 78f;
        private const float BodyTop = ModernUiTheme.TitleBarHeight + 4f;

        private static GraphicsSettingsWindow instance;

        private RectTransform body;

        private static readonly float[] RenderScales = { 1f, 0.85f, 0.7f, 0.55f };
        private static readonly string[] RenderScaleNames = { "100%", "85%", "70%", "55%" };
        private static readonly int[] FrameCaps = { 0, 60, 30 };
        private static readonly string[] FrameCapNames = { "ไม่จำกัด", "60", "30" };

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
            instance.Redraw();
        }

        private static GraphicsSettingsWindow Build()
        {
            var ui = UiManager.Instance;
            if (ui == null || ui.PrimaryUserWindowContainer == null)
                return null;

            var host = new GameObject("GraphicsSettingsWindow", typeof(Image));
            host.SetActive(false);
            host.transform.SetParent(ui.PrimaryUserWindowContainer, false);

            var background = host.GetComponent<Image>();
            background.sprite = ModernUiTheme.RoundedSprite;
            background.type = Image.Type.Sliced;
            background.color = ModernUiTheme.WindowColor;
            background.raycastTarget = true;

            var window = host.AddComponent<GraphicsSettingsWindow>();
            window.CanCloseWithEscape = true;
            ModernUiTheme.MarkSkinned(host);

            var rect = (RectTransform)host.transform;
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(Width, Height);

            ModernUiTheme.CreateTitleBar(window, "ตั้งค่าภาพ", "ปรับให้ลื่นขึ้นบนเครื่องที่แรงน้อย",
                ModernUiIcons.Bolt);
            ModernUiTheme.AttachShadow(rect);

            var viewport = ModernUiTheme.CreateCard(rect, "Viewport", ModernUiTheme.CardDeepColor);
            ModernUiTheme.Stretch(viewport, Pad, Pad, -Pad, -BodyTop);
            viewport.gameObject.AddComponent<RectMask2D>();

            window.body = ModernUiTheme.CreateRect("Rows", viewport);
            window.body.anchorMin = new Vector2(0, 1);
            window.body.anchorMax = new Vector2(1, 1);
            window.body.pivot = new Vector2(0.5f, 1);
            window.body.offsetMin = Vector2.zero;
            window.body.offsetMax = Vector2.zero;

            //Every switch here is one line of text taller than it needs to be, and there are
            //eleven of them, so the list does not fit a phone screen and is not going to.
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

        // =====================================================================
        // Drawing

        private void Redraw()
        {
            for (var i = body.childCount - 1; i >= 0; i--)
                Destroy(body.GetChild(i).gameObject);

            var data = GameConfig.Data;
            if (data == null)
                return;

            var y = Pad;
            y = DrawPresets(data, y);
            y += 8f;

            y = Heading("ปรับเอง", y);
            y = Choice(y, "ความละเอียดภาพ", RenderScaleNames, NearestScaleIndex(data.RenderScale),
                index => data.RenderScale = RenderScales[index],
                "ได้ผลที่สุด ภาพในเกมนุ่มขึ้นนิดหน่อย ตัวหนังสือยังคมเท่าเดิม");
            y = Switch(y, "เงา", data.EnableShadows, on => data.EnableShadows = on,
                "ปิดแล้วประหยัดมาก แมพไม่ต้องวาดซ้ำอีกรอบเพื่อทำเงา");
            y = Switch(y, "สีสว่างพิเศษ (HDR)", data.EnableHdr, on => data.EnableHdr = on,
                "เกมนี้เป็นภาพ 2 มิติ ปิดแล้วแทบไม่ต่าง แต่ประหยัดแบนด์วิดท์");
            y = Switch(y, "ผิวน้ำสะท้อน", data.EnableWaterReflection, on => data.EnableWaterReflection = on,
                "มีผลเฉพาะแมพที่มีน้ำ");
            y = Switch(y, "เอฟเฟ็คตกแต่งแมพ", data.EnableMapEffects, on => data.EnableMapEffects = on,
                "คบไฟ ประกายไฟ ควัน ที่เป็นของประดับแมพ");
            y = Switch(y, "แสดงผู้เล่นคนอื่น", data.ShowOtherPlayers, on => data.ShowOtherPlayers = on,
                "ปิดแล้วเหลือมอน ไอเท็ม NPC และคนในปาร์ตี้ ช่วยมากในเมืองที่ร้านเยอะ");
            y = Switch(y, "ลดภาพเคลื่อนไหวไกลตัว", data.ThrottleDistantAnimation,
                on => data.ThrottleDistantAnimation = on,
                "ตัวที่อยู่ไกลกล้องขยับทุก 2 เฟรมแทนทุกเฟรม");
            y = Switch(y, "ลดขนาดพื้นผิว (ประหยัดแรม)", data.HalfTextureMemory,
                on => data.HalfTextureMemory = on,
                "เหลือ 1 ใน 4 ของแรมเดิม สำหรับเครื่องที่แท็บเด้งหรือค้าง ไม่ใช่แค่กระตุก");
            y = Choice(y, "จำกัดเฟรม", FrameCapNames, NearestCapIndex(data.FrameRateCap),
                index => data.FrameRateCap = FrameCaps[index],
                "เครื่องที่ทำได้ 40 แต่ไม่ถึง 60 ล็อก 30 จะรู้สึกนิ่งกว่า");

            y += 8f;
            y = Heading("วัดผล", y);
            y = Switch(y, "แสดงตัวนับ FPS", data.ShowFpsCounter, on => data.ShowFpsCounter = on,
                "มุมซ้ายบน ดูเลข \"เฟรมแย่สุด\" เป็นหลัก นั่นคือตัวที่ทำให้รู้สึกหลุด");

            var footer = ModernUiTheme.CreateText(body, "Footer",
                "เปลี่ยนแล้วเห็นผลทันที ไม่ต้องออกจากเกม  ·  ลดขนาดพื้นผิวจะค่อย ๆ มีผลตอนโหลดภาพชุดใหม่",
                ModernUiTheme.SizeSmall - 1f, ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Place((RectTransform)footer.transform, new Vector2(0, 1),
                new Vector2(10f, -(y + 4f)), new Vector2(Width - Pad * 2f - 20f, 34f));
            y += 42f;

            body.sizeDelta = new Vector2(0, y);
        }

        private float DrawPresets(GameConfigData data, float y)
        {
            y = Heading("แบบสำเร็จรูป", y);

            var count = GraphicsQuality.PresetNames.Length - 1; //Custom is a state, not a choice
            var usable = Width - Pad * 2f - 8f;
            var width = (usable - (count - 1) * 5f) / count;

            for (var i = 0; i < count; i++)
            {
                var preset = i;
                var active = data.GraphicsPreset == preset;

                var button = ModernUiTheme.CreateButton(body, "Preset" + i, GraphicsQuality.PresetNames[i],
                    active ? ModernUiTheme.AccentColor : ModernUiTheme.CardColor,
                    active ? ModernUiTheme.AccentTextColor : ModernUiTheme.NameColor,
                    ModernUiTheme.SizeSmall);
                ModernUiTheme.Place((RectTransform)button.transform, new Vector2(0, 1),
                    new Vector2(4f + i * (width + 5f), -y), new Vector2(width, PresetHeight));

                if (!active)
                    ModernUiTheme.AddBorder((RectTransform)button.transform, ModernUiTheme.CardBorderColor);

                button.onClick.AddListener(() =>
                {
                    GraphicsQuality.FillFromPreset(GameConfig.Data, preset);
                    ApplyAndSave();
                });
            }

            return y + PresetHeight + RowGap;
        }

        private float Heading(string text, float y)
        {
            var label = ModernUiTheme.CreateText(body, "Heading", text, ModernUiTheme.SizeSmall,
                ModernUiTheme.LabelColor, TextAlignmentOptions.BottomLeft, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)label.transform, new Vector2(0, 1),
                new Vector2(6f, -y), new Vector2(Width - Pad * 2f - 12f, 22f));

            return y + 24f;
        }

        /// <summary>One setting that is either on or off, with the reason it exists under it.</summary>
        private float Switch(float y, string title, bool value, Action<bool> set, string hint)
        {
            var row = Row(y, title, hint);

            var button = ModernUiTheme.CreateButton(row, "Value", value ? "เปิด" : "ปิด",
                value ? ModernUiTheme.AccentColor : ModernUiTheme.CardDeepColor,
                value ? ModernUiTheme.AccentTextColor : ModernUiTheme.MutedColor,
                ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(1, 0.5f),
                new Vector2(-9f, 0f), new Vector2(ControlWidth, RowHeight - 18f));

            button.onClick.AddListener(() =>
            {
                set(!value);
                MarkCustom();
                ApplyAndSave();
            });

            return y + RowHeight + RowGap;
        }

        /// <summary>One setting with a handful of steps, cycled by pressing it.</summary>
        private float Choice(float y, string title, string[] options, int index, Action<int> set, string hint)
        {
            var row = Row(y, title, hint);
            var shown = Mathf.Clamp(index, 0, options.Length - 1);

            var button = ModernUiTheme.CreateButton(row, "Value", options[shown] + "  ›",
                ModernUiTheme.CardColor, ModernUiTheme.NameColor, ModernUiTheme.SizeSmall);
            ModernUiTheme.Place((RectTransform)button.transform, new Vector2(1, 0.5f),
                new Vector2(-9f, 0f), new Vector2(ControlWidth, RowHeight - 18f));
            ModernUiTheme.AddBorder((RectTransform)button.transform, ModernUiTheme.CardBorderColor);

            button.onClick.AddListener(() =>
            {
                set((shown + 1) % options.Length);
                MarkCustom();
                ApplyAndSave();
            });

            return y + RowHeight + RowGap;
        }

        /// <summary>The card behind one setting: its name, and under it what turning it off buys.</summary>
        private RectTransform Row(float y, string title, string hint)
        {
            var row = ModernUiTheme.CreateCard(body, "Row", ModernUiTheme.CardColor);
            ModernUiTheme.Place(row, new Vector2(0, 1), new Vector2(4f, -y),
                new Vector2(Width - Pad * 2f - 8f, RowHeight));
            row.GetComponent<Image>().raycastTarget = false;

            var textWidth = Width - Pad * 2f - ControlWidth - 40f;

            var label = ModernUiTheme.CreateText(row, "Title", title, ModernUiTheme.SizeSmall,
                ModernUiTheme.NameColor, TextAlignmentOptions.BottomLeft, FontStyles.Bold);
            ModernUiTheme.Place((RectTransform)label.transform, new Vector2(0, 1),
                new Vector2(10f, -6f), new Vector2(textWidth, 20f));

            var note = ModernUiTheme.CreateText(row, "Hint", hint ?? string.Empty,
                ModernUiTheme.SizeSmall - 2f, ModernUiTheme.MutedColor, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Place((RectTransform)note.transform, new Vector2(0, 1),
                new Vector2(10f, -26f), new Vector2(textWidth, 24f));

            return row;
        }

        private static int NearestScaleIndex(float scale)
        {
            var best = 0;
            for (var i = 1; i < RenderScales.Length; i++)
            {
                if (Mathf.Abs(RenderScales[i] - scale) < Mathf.Abs(RenderScales[best] - scale))
                    best = i;
            }

            return best;
        }

        private static int NearestCapIndex(int cap)
        {
            for (var i = 0; i < FrameCaps.Length; i++)
            {
                if (FrameCaps[i] == cap)
                    return i;
            }

            return 0;
        }

        /// <summary>
        /// Changing one switch by hand means the settings are no longer any of the presets,
        /// and saying so is what stops the window claiming to be on Low while showing shadows.
        /// </summary>
        private static void MarkCustom()
        {
            if (GameConfig.Data != null)
                GameConfig.Data.GraphicsPreset = GraphicsQuality.PresetCustom;
        }

        private void ApplyAndSave()
        {
            GraphicsQuality.Apply(GameConfig.Data);
            PerformanceOverlay.SetVisible(GameConfig.Data.ShowFpsCounter);
            GameConfig.SaveConfig();
            Redraw();
        }
    }
}
