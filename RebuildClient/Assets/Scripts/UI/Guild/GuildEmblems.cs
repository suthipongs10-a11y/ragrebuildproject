using UnityEngine;
using Assets.Scripts.Sprites;

namespace Assets.Scripts.UI.Guild
{
    /// <summary>
    /// The pictures a guild can wear, and their numbers.
    ///
    /// Every one is an icon the game already ships - the skill icons out of the item atlas,
    /// which is loaded and drawn from all over the interface already. That was the whole
    /// point of choosing them: a guild can have a mark today rather than after somebody
    /// draws thirty of them, and there is no new art to extract, import, or ship.
    ///
    /// The number is what travels and what is stored, so <b>the order of this list is a
    /// save format</b>. Add to the end; never reorder, and never remove. A guild whose
    /// emblem moved would silently be wearing somebody else's.
    ///
    /// Index 0 is deliberately empty and means "no emblem".
    /// </summary>
    public static class GuildEmblems
    {
        private static readonly string[] Icons =
        {
            "",                    // 0 - none

            //blades and blunt things
            "sm_sword",            // 1
            "bs_twohandsword",     // 2
            "bs_spear",            // 3
            "bs_mace",             // 4
            "as_katar",            // 5
            "kn_pierce",           // 6
            "sm_bash",             // 7
            "kn_bowlingbash",      // 8
            "bs_hammerfall",       // 9
            "mc_mammonite",        // 10
            "as_sonicblow",        // 11
            "ht_steelcrow",        // 12
            "sm_magnum",           // 13

            //the elements
            "mg_firebolt",         // 14
            "mg_coldbolt",         // 15
            "mg_lightningbolt",    // 16
            "mg_fireball",         // 17
            "wz_meteor",           // 18
            "wz_stormgust",        // 19
            "wz_jupitel",          // 20
            "wz_frostnova",        // 21
            "wz_earthspike",       // 22
            "mg_thunderstorm",     // 23
            "wz_firepillar",       // 24

            //wings, light and beasts
            "al_angelus",          // 25
            "al_blessing",         // 26
            "al_crucis",           // 27
            "al_holylight",        // 28
            "pr_kyrie",            // 29
            "ht_falcon",           // 30
        };

        /// <summary>The highest number there is a picture for. Matches the server's cap.</summary>
        public static int MaxId => Icons.Length - 1;

        public static bool IsValid(int id) => id > 0 && id < Icons.Length;

        /// <summary>
        /// The picture for a number, or null for none and for anything out of range.
        ///
        /// Out of range answers the same as none rather than throwing: the number arrives
        /// over the network, and a client one version behind the server would otherwise
        /// die on a guild that picked an emblem it has never heard of.
        /// </summary>
        public static Sprite Sprite(int id)
        {
            if (!IsValid(id))
                return null;

            var loader = ClientDataLoader.Instance;
            return loader == null ? null : loader.GetIconAtlasSprite(Icons[id]);
        }
    }
}
