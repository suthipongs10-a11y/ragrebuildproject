using System.Text;
using Assets.Scripts.PlayerControl;
using UnityEngine;
using UnityEngine.UI;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// Says what the hotbar actually is right now, in chat.
    ///
    /// A phone has no console and no inspector. Reading the code has already failed twice
    /// here: everything says a skill put into slot 0 should appear, and it does not, which
    /// means something about the running object is not what the source says it is. This
    /// prints the few facts that would tell them apart - whether the entry the code writes
    /// to is the square being looked at, whether its icon object is switched on, where it
    /// is on screen, and whether the thing that answers a tap is attached.
    ///
    /// Diagnostic only. Nothing calls it but the /hotbar command.
    /// </summary>
    public static class HotbarReport
    {
        public static void Print()
        {
            var camera = CameraFollower.Instance;
            if (camera == null)
                return;

            var hotbar = UiManager.Instance != null ? UiManager.Instance.SkillHotbar : null;
            if (hotbar == null)
            {
                camera.AppendChatText($"<color={ChatColor.System}>hotbar: ไม่มี SkillHotbar</color>");
                return;
            }

            var bar = (RectTransform)hotbar.transform;
            camera.AppendChatText($"<color={ChatColor.System}>bar act={On(bar.gameObject)} "
                                  + $"scale={bar.lossyScale.x:0.00} entries={hotbar.EntryCount} "
                                  + $"{Where(bar)}</color>");

            var container = hotbar.SkillBarContainer as RectTransform;
            if (container != null)
                camera.AppendChatText($"<color={ChatColor.System}>box act={On(container.gameObject)} "
                                      + $"rows={container.childCount} {Where(container)}</color>");

            var shown = 0;
            for (var i = 0; i < hotbar.EntryCount && shown < 4; i++)
            {
                var entry = hotbar.GetEntryById(i);
                if (entry == null)
                {
                    camera.AppendChatText($"<color={ChatColor.System}>{i}: null</color>");
                    shown++;
                    continue;
                }

                var line = new StringBuilder();
                line.Append(i).Append(": ");

                var drag = entry.DragItem;
                if (drag == null)
                    line.Append("no dragitem ");
                else
                {
                    line.Append(drag.Type).Append('#').Append(drag.ItemId);
                    line.Append(" on=").Append(On(drag.gameObject));

                    var icon = drag.Image;
                    if (icon == null)
                        line.Append(" icon=null");
                    else
                        line.Append(" icon=").Append(On(icon.gameObject))
                            .Append(icon.sprite == null ? "/nosprite" : "/" + icon.sprite.name)
                            .Append(" a=").Append(icon.color.a.ToString("0.0"));
                }

                line.Append(entry.GetComponent<HotbarSlotTap>() != null ? " tap" : " NOTAP");
                line.Append(' ').Append(Where((RectTransform)entry.transform));

                camera.AppendChatText($"<color={ChatColor.System}>{line}</color>");
                shown++;
            }
        }

        private static string On(GameObject go) => go.activeInHierarchy ? "1" : "0";

        /// <summary>Where a rect is on the screen, in pixels, and how big.</summary>
        private static string Where(RectTransform rect)
        {
            var corners = new Vector3[4];
            rect.GetWorldCorners(corners);

            var canvas = rect.GetComponentInParent<Canvas>();
            var camera = canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay
                ? canvas.worldCamera
                : null;

            var min = RectTransformUtility.WorldToScreenPoint(camera, corners[0]);
            var max = RectTransformUtility.WorldToScreenPoint(camera, corners[2]);

            return $"@{min.x:0},{min.y:0} {max.x - min.x:0}x{max.y - min.y:0}";
        }
    }
}
