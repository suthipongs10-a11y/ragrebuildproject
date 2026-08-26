using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// The band across the top of the screen that server announcements arrive on.
    ///
    /// Announcements were already reaching every player, but only into the chat log,
    /// where a +10 refine or an MVP kill scrolled past between two lines about picking
    /// up herbs. The whole point of announcing something is that people look up, so the
    /// same line is now also thrown across the top of the screen for a few seconds.
    ///
    /// Built at runtime like the rest of the modern interface, so there is no prefab to
    /// keep in step. Announcements that land while one is already showing queue up behind
    /// it rather than cutting it off.
    /// </summary>
    public class AnnouncementBanner : MonoBehaviour
    {
        /// <summary>How long a line stays fully readable, before the fade out.</summary>
        private const float HoldTime = 4.5f;

        private const float FadeInTime = 0.25f;
        private const float FadeOutTime = 0.6f;

        /// <summary>
        /// Dark, so gold text sits on it at full strength. The chat log is dark for the
        /// same reason and this has to read against whatever the world is doing behind it.
        /// </summary>
        private static readonly Color PlateColor = new Color(0.118f, 0.086f, 0.047f, 0.88f);

        private static readonly Color RuleColor = new Color(1f, 0.784f, 0.239f, 0.75f);

        /// <summary>The fallback ink, used when a message brings no colour of its own.</summary>
        private static readonly Color InkColor = new Color(1f, 0.847f, 0.404f);

        private static AnnouncementBanner instance;

        private readonly Queue<string> pending = new();

        private CanvasGroup group;
        private RectTransform plate;
        private TextMeshProUGUI label;
        private float timer;
        private bool showing;

        /// <summary>
        /// Called from the packet handler. Safe to call before anything has been built:
        /// the banner puts itself together the first time it is actually needed, which
        /// keeps it out of the way for players who never see an announcement.
        /// </summary>
        public static void Show(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return;

            if (instance == null)
            {
                var host = new GameObject("AnnouncementBanner");
                DontDestroyOnLoad(host);
                instance = host.AddComponent<AnnouncementBanner>();
            }

            instance.pending.Enqueue(text);
        }

        private void Build()
        {
            var manager = UiManager.Instance;
            if (manager == null || manager.PrimaryUserUIContainer == null)
                return;

            var parent = manager.PrimaryUserUIContainer.transform;

            //the container goes with the scene on a map change while this component does
            //not, so on the far side of a warp there can already be one waiting
            var existing = parent.Find("ModernAnnouncement");
            if (existing != null)
            {
                plate = (RectTransform)existing;
                group = existing.GetComponent<CanvasGroup>();
                label = existing.Find("Text")?.GetComponent<TextMeshProUGUI>();
                if (label != null)
                    return;
                Destroy(existing.gameObject);
            }

            //its own object rather than a child of a window, so nothing the player opens
            //can end up drawn over the top of it
            var root = new GameObject("ModernAnnouncement", typeof(RectTransform), typeof(CanvasGroup));
            root.transform.SetParent(parent, false);
            root.transform.SetAsLastSibling();

            plate = (RectTransform)root.transform;
            plate.anchorMin = new Vector2(0.5f, 1f);
            plate.anchorMax = new Vector2(0.5f, 1f);
            plate.pivot = new Vector2(0.5f, 1f);
            plate.anchoredPosition = new Vector2(0f, -18f);
            plate.sizeDelta = new Vector2(720f, 46f);

            group = root.GetComponent<CanvasGroup>();
            group.alpha = 0f;
            //it is a notice, not a control. Clicks belong to whatever is behind it.
            group.blocksRaycasts = false;
            group.interactable = false;

            var back = ModernUiTheme.CreateCard(plate, "Plate", PlateColor);
            ModernUiTheme.Stretch(back, 0, 0, 0, 0);
            back.GetComponent<Image>().raycastTarget = false;

            //a gold rule under the text, which is what makes it read as a banner rather
            //than as a floating tooltip that happens to be dark
            var rule = ModernUiTheme.CreateCard(plate, "Rule", RuleColor);
            rule.anchorMin = new Vector2(0f, 0f);
            rule.anchorMax = new Vector2(1f, 0f);
            rule.pivot = new Vector2(0.5f, 0f);
            rule.offsetMin = new Vector2(14f, 0f);
            rule.offsetMax = new Vector2(-14f, 2f);
            rule.GetComponent<Image>().raycastTarget = false;

            label = ModernUiTheme.CreateText(plate, "Text", "", ModernUiTheme.SizeValue, InkColor,
                TextAlignmentOptions.Center, FontStyles.Bold);
            ModernUiTheme.Stretch(label.rectTransform, 18f, 4f, -18f, -2f);
            label.overflowMode = TextOverflowModes.Ellipsis;

            ModernUiTheme.AttachShadow(plate, 10f);
        }

        private void Update()
        {
            if (plate == null)
            {
                //UiManager comes up with the scene, so the first announcement of a session
                //can arrive before there is anywhere to put it
                Build();
                if (plate == null)
                    return;
            }

            if (showing)
            {
                timer -= Time.deltaTime;

                //timer counts the whole life of the line down to zero, so how far in we
                //are is the difference, and how far from the end is the timer itself
                var elapsed = HoldTime + FadeOutTime - timer;
                float alpha;
                if (elapsed < FadeInTime)
                    alpha = elapsed / FadeInTime;
                else if (timer < FadeOutTime)
                    alpha = timer / FadeOutTime;
                else
                    alpha = 1f;

                group.alpha = Mathf.Clamp01(alpha);

                if (timer > 0f)
                    return;

                showing = false;
                group.alpha = 0f;
            }

            if (pending.Count == 0)
                return;

            label.text = pending.Dequeue();
            //the plate follows the line rather than the line being squeezed into the
            //plate, so a short announcement is not a wide empty bar
            var width = Mathf.Clamp(label.preferredWidth + 56f, 320f, 900f);
            plate.sizeDelta = new Vector2(width, 46f);

            timer = HoldTime + FadeOutTime;
            showing = true;
        }
    }
}
