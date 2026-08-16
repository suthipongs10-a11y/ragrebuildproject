using Assets.Scripts.Network;
using RebuildSharedData.Enum;
using UnityEngine;

namespace Assets.Scripts.UI.Hud
{
    /// <summary>
    /// Keeps every NPC's name showing over its head.
    ///
    /// The client only ever puts a name up while the pointer is over something or while it
    /// is the target, which is right for monsters — a field with forty labels floating over
    /// it is unreadable — and wrong for NPCs. An NPC is a thing you walk up to on purpose,
    /// and you cannot walk up to it on purpose if finding out what it is means hovering
    /// every figure in town. The Job Master is the one that made the point: renaming him
    /// changed nothing anybody could see.
    ///
    /// Done by re-asserting the hover plate rather than by adding a plate of our own, so
    /// there is one nameplate implementation and NPC names look like every other name.
    /// The client's own hover handling still runs on top and simply agrees with this.
    /// </summary>
    public class NpcNamePlates : MonoBehaviour
    {
        /// <summary>
        /// Slow on purpose. Nothing here changes between frames — it exists to catch NPCs
        /// that have just come into view — and the plate stays up on its own in between.
        /// </summary>
        private const float SweepInterval = 0.5f;

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

                entity.ShowHoverNamePlate(name);
            }
        }
    }
}
