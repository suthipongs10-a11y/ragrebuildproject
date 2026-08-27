using System.Collections.Generic;
using System.Text;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using UnityEngine;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.UI.Guild
{
    /// <summary>
    /// Says which emblem pictures the atlas actually has, in chat.
    ///
    /// Every cell in the picker came out empty, which means the lookup returned nothing for
    /// all sixty - and sixty failures with one cause is a different problem from sixty
    /// missing files. Reading the code cannot tell them apart: the skill icons resolve
    /// through this exact call everywhere else in the interface, and the item names come
    /// straight out of the item data.
    ///
    /// So this asks the atlas directly, and tries the two spellings that could differ - the
    /// bare name and the one the sprites turned out to be called when the hotbar was
    /// examined ("skill_mc_vending" for the icon named "mc_vending").
    ///
    /// Diagnostic only. Nothing calls it but the /emblems command.
    /// </summary>
    public static class EmblemReport
    {
        public static void Print()
        {
            var camera = CameraFollower.Instance;
            if (camera == null)
                return;

            var loader = ClientDataLoader.Instance;
            if (loader == null)
            {
                Say(camera, "emblems: ไม่มี ClientDataLoader");
                return;
            }

            var found = new List<string>();
            var missing = new List<string>();
            var prefixed = new List<string>();

            for (var id = 1; id <= GuildEmblems.MaxId; id++)
            {
                var name = GuildEmblems.NameOf(id);
                if (string.IsNullOrEmpty(name))
                    continue;

                if (loader.GetIconAtlasSprite(name) != null)
                    found.Add(name);
                else if (loader.GetIconAtlasSprite("skill_" + name) != null)
                    prefixed.Add(name);
                else
                    missing.Add(name);
            }

            Say(camera, $"emblems: {found.Count} เจอ, {prefixed.Count} เจอเมื่อเติม skill_, "
                        + $"{missing.Count} ไม่เจอ");

            //a couple of known good names from elsewhere in the interface, as a control:
            //if these fail too then it is the atlas, not the list
            Say(camera, $"control: mc_mammonite={Mark(loader, "mc_mammonite")} "
                        + $"skill_mc_mammonite={Mark(loader, "skill_mc_mammonite")} "
                        + $"Apple={Mark(loader, "Apple")}");

            Report(camera, "เจอ", found);
            Report(camera, "ต้องเติม skill_", prefixed);
            Report(camera, "ไม่เจอ", missing);
        }

        private static string Mark(ClientDataLoader loader, string name) =>
            loader.GetIconAtlasSprite(name) != null ? "1" : "0";

        private static void Report(CameraFollower camera, string label, List<string> names)
        {
            if (names.Count == 0)
                return;

            var line = new StringBuilder();
            for (var i = 0; i < names.Count && i < 6; i++)
            {
                if (i > 0)
                    line.Append(", ");
                line.Append(names[i]);
            }

            Say(camera, $"{label} ({names.Count}): {line}");
        }

        private static void Say(CameraFollower camera, string text) =>
            camera.AppendChatText($"<color={ChatColor.System}>{text}</color>");
    }
}
