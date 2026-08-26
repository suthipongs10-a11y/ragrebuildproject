using Assets.Scripts.UI;
using Assets.Scripts.UI.ConfigWindow;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.Rendering
{
    /// <summary>
    /// A frame rate readout in the corner, so a setting can be judged by what it does rather
    /// than by whether it feels better.
    /// </summary>
    /// <remarks>
    /// Three numbers, because one is not enough to tell the two complaints apart. An average
    /// says whether the device can keep up at all. The worst frame of the last second is what
    /// people actually notice - a run that averages fifty but drops one frame of two hundred
    /// milliseconds reads as broken, while a steady thirty reads as fine. The millisecond
    /// figure is the one that adds up: half of sixteen milliseconds saved is a real saving,
    /// where "ten more frames" means something different at thirty than at ninety.
    ///
    /// Its own canvas rather than a corner of the game's, so it is up on the title screen and
    /// during a map load, which is where the worst of it happens.
    /// </remarks>
    public class PerformanceOverlay : MonoBehaviour
    {
        private const float SampleWindow = 1f;

        private static PerformanceOverlay instance;

        private TextMeshProUGUI label;
        private float elapsed;
        private int frames;
        private float worstFrame;
        private float shownAverage;
        private float shownWorst;

        public static void SetVisible(bool visible)
        {
            if (!visible)
            {
                if (instance != null)
                    instance.gameObject.SetActive(false);
                return;
            }

            if (instance == null)
                instance = Build();

            if (instance != null)
                instance.gameObject.SetActive(true);
        }

        private static PerformanceOverlay Build()
        {
            var host = new GameObject("PerformanceOverlay", typeof(Canvas), typeof(CanvasScaler));
            DontDestroyOnLoad(host);

            var canvas = host.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            //above every window the game puts up, including the ones that move themselves to
            //the top, so it is never the thing that gets covered while being read
            canvas.sortingOrder = 32000;

            var scaler = host.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
            scaler.scaleFactor = 1f;

            var overlay = host.AddComponent<PerformanceOverlay>();

            var panel = ModernUiTheme.CreateCard(host.transform, "Panel", new Color(0f, 0f, 0f, 0.55f));
            ModernUiTheme.Place(panel, new Vector2(0, 1), new Vector2(8f, -8f), new Vector2(190f, 46f));
            panel.GetComponent<Image>().raycastTarget = false;

            overlay.label = ModernUiTheme.CreateText(panel, "Readout", "", ModernUiTheme.SizeSmall,
                Color.white, TextAlignmentOptions.TopLeft);
            ModernUiTheme.Place((RectTransform)overlay.label.transform, new Vector2(0, 1),
                new Vector2(8f, -5f), new Vector2(178f, 40f));

            return overlay;
        }

        private void Update()
        {
            //Unscaled, because this measures the device rather than the game clock; a paused
            //or slowed game still has to draw.
            var delta = Time.unscaledDeltaTime;
            elapsed += delta;
            frames++;
            if (delta > worstFrame)
                worstFrame = delta;

            if (elapsed < SampleWindow)
                return;

            shownAverage = frames / elapsed;
            shownWorst = worstFrame;
            elapsed = 0f;
            frames = 0;
            worstFrame = 0f;

            var preset = GameConfig.Data != null
                ? GraphicsQuality.PresetNames[Mathf.Clamp(GameConfig.Data.GraphicsPreset, 0,
                    GraphicsQuality.PresetNames.Length - 1)]
                : "-";

            label.text =
                $"{shownAverage:F0} fps   {1000f / Mathf.Max(shownAverage, 0.01f):F1} ms\n"
                + $"เฟรมแย่สุด {shownWorst * 1000f:F0} ms\n"
                + $"<size=-2>ภาพ: {preset}</size>";
        }
    }
}
