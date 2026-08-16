using Assets.Scripts.Network;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using TMPro;
using UnityEngine;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// Stands a sign over every NPC, permanently.
    ///
    /// The client only ever puts a name up while the pointer is over something or while it
    /// is the target, which is right for monsters — a field with forty labels floating over
    /// it is unreadable — and wrong for NPCs. An NPC is a thing you walk up to on purpose,
    /// and you cannot do that if finding out what it is means hovering every figure in
    /// town. The Job Master is the one that made the point: renaming him changed nothing
    /// anybody could see, and the hover plate, when it did appear, was small dark text.
    ///
    /// So this is a sign of its own rather than the hover plate held open: white, bold, and
    /// large enough to read from where you are standing, which the hover plate is not and
    /// should not be — it has monsters to label too.
    /// </summary>
    public class NpcNamePlates : MonoBehaviour
    {
        /// <summary>
        /// Slow on purpose. It exists to catch NPCs that have just come into view; the sign
        /// stays up on its own in between.
        /// </summary>
        private const float SweepInterval = 0.5f;

        /// <summary>Above the head rather than through it. Sprites here stand 1.5 tall.</summary>
        private const float SignHeight = 2.35f;

        private const float SignFontSize = 3.4f;
        private const string SignName = "NpcSign";

        private float timer;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ModernUiTheme.RuntimeUiEnabled)
                return;

            if (FindFirstObjectByType<NpcNamePlates>() != null)
                return;

            var host = new GameObject("NpcNamePlates");
            DontDestroyOnLoad(host);
            host.AddComponent<NpcNamePlates>();
        }

        private void Update()
        {
            timer -= Time.deltaTime;
            if (timer > 0)
                return;
            timer = SweepInterval;

            var network = NetworkManager.Instance;
            if (network == null)
                return;

            foreach (var entry in network.EntityList)
            {
                var entity = entry.Value;
                if (entity == null || entity.CharacterType != CharacterType.NPC)
                    continue;

                //Some NPCs are not people: a vending sign, a chat room marker, an effect
                //standing in for something. Those carry a name the player was never meant
                //to read, and the client marks them by prefixing it.
                var name = entity.Name;
                if (string.IsNullOrWhiteSpace(name) || name.StartsWith("[NPC]"))
                    continue;

                if (entity.transform.Find(SignName) != null)
                    continue;

                BuildSign(entity.transform, name);
            }
        }

        private static void BuildSign(Transform parent, string name)
        {
            var go = new GameObject(SignName);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(0, SignHeight, 0);

            var text = go.AddComponent<TextMeshPro>();
            if (ModernUiTheme.ThemeFont != null)
                text.font = ModernUiTheme.ThemeFont;

            text.text = name;
            text.fontSize = SignFontSize;
            text.color = Color.white;
            text.fontStyle = FontStyles.Bold;
            text.alignment = TextAlignmentOptions.Center;
            text.enableWordWrapping = false;
            text.raycastTarget = false;

            //White alone disappears against a snow map or a pale wall, and RO backgrounds
            //are every colour there is. A dark edge is what makes one label work everywhere
            //rather than most places.
            text.outlineWidth = 0.22f;
            text.outlineColor = new Color32(0, 0, 0, 255);

            //wide enough that a long name is not folded onto a second line
            text.rectTransform.sizeDelta = new Vector2(14f, 2f);

            //faces the camera along with everything else in the world
            go.AddComponent<BillboardObject>();
        }
    }
}
