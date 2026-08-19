using UnityEngine;
using Assets.Scripts.Sprites;

namespace Assets.Scripts.UI.Guild
{
    /// <summary>
    /// The pictures a guild can wear, and their numbers.
    ///
    /// Every one is an icon the game already ships, out of the same atlas the rest of the
    /// interface draws from: first the skill icons, then the rank 4 weapons and the odder
    /// headgear. That was the whole point of choosing them - a guild can have a mark today
    /// rather than after somebody draws sixty of them, with no new art to extract or ship.
    ///
    /// The names here are atlas keys, and the atlas uses two different spellings, which is
    /// what made the first version of this list come out entirely blank:
    ///
    /// A skill icon is stored under its name with "skill_" in front - the icon Skills.toml
    /// calls "mc_mammonite" is in the atlas as "skill_mc_mammonite".
    ///
    /// An item icon is stored under the item's <b>Code</b>, not the sprite file it was
    /// imported from. The importer reads the Korean file name out of the item data and
    /// files the picture under the English code beside it, so "Excalibur" finds the icon
    /// and the Korean name it was built from finds nothing.
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
            "skill_sm_sword",            // 1
            "skill_bs_twohandsword",     // 2
            "skill_bs_spear",            // 3
            "skill_bs_mace",             // 4
            "skill_as_katar",            // 5
            "skill_kn_pierce",           // 6
            "skill_sm_bash",             // 7
            "skill_kn_bowlingbash",      // 8
            "skill_bs_hammerfall",       // 9
            "skill_mc_mammonite",        // 10
            "skill_as_sonicblow",        // 11
            "skill_ht_steelcrow",        // 12
            "skill_sm_magnum",           // 13

            //the elements
            "skill_mg_firebolt",         // 14
            "skill_mg_coldbolt",         // 15
            "skill_mg_lightningbolt",    // 16
            "skill_mg_fireball",         // 17
            "skill_wz_meteor",           // 18
            "skill_wz_stormgust",        // 19
            "skill_wz_jupitel",          // 20
            "skill_wz_frostnova",        // 21
            "skill_wz_earthspike",       // 22
            "skill_mg_thunderstorm",     // 23
            "skill_wz_firepillar",       // 24

            //wings, light and beasts
            "skill_al_angelus",          // 25
            "skill_al_blessing",         // 26
            "skill_al_crucis",           // 27
            "skill_al_holylight",        // 28
            "skill_pr_kyrie",            // 29
            "skill_ht_falcon",           // 30

            //Legendary blades, all rank 4. Two of them - Mysteltainn and Tyrfing - are the
            //names of bosses as well as of weapons, which is as close to a boss portrait as
            //this can get: monsters are animated sprite files rendered by their own
            //renderer, not flat pictures in the icon atlas, so there is nothing to put in
            //an Image for them.
            "Excalibur",              // 31 Excalibur
            "Muramasa",               // 32 Muramasa
            "Masamune",               // 33 Masamune
            "Balmung",                 // 34 Balmung
            "Mistilteinn",              // 35 Mistilteinn
            "Tyrfing",                // 36 Tyrfing
            "Dragon_Slayer",            // 37 Dragon Slayer
            "Nagan",                // 38 Nagan
            "Ice_Falchion",             // 39 Ice Falchion
            "Fire_Brand",             // 40 Fire Brand

            //the rest of the rank 4 armoury, one of each kind
            "Gungnir",                // 41 Gungnir
            "Crescent_Scythe",            // 42 Crescent Scythe
            "Bloody_Axe",              // 43 Bloody Axe
            "Infiltrator",             // 44 Infiltrator
            "Kaiser_Knuckle",              // 45 Kaiser Knuckle
            "Ballista",               // 46 Ballista
            "Wizardry_Staff",            // 47 Wizardry Staff
            "Book_of_the_Apocalypse",                // 48 Book of the Apocalypse
            "Huuma_Giant_Wheel_Shuriken",             // 49 Huuma Giant Wheel Shuriken
            "Dagger_of_Counter",              // 50 Dagger of Counter
            "Golden_Mace",              // 51 Golden Mace

            //headgear worth looking at, including one an MVP wears
            "Orc_Hero_Helm",            // 52 Orc Hero Helm
            "Valkyrian_Helm",              // 53 Valkyrian Helm
            "Fricca's_Circlet",             // 54 Fricca's Circlet
            "Morpheus's_Hood",            // 55 Morpheus's Hood
            "Morrigane's_Helm",             // 56 Morrigane's Helm
            "Goibne's_Helm",             // 57 Goibne's Helm
            "Mythical_Lion_Mask",                // 58 Mythical Lion Mask
            "Bride_Mask",                // 59 Bride Mask
            "Black_Cat_Ears",             // 60 Black Cat Ears
        };

        /// <summary>The highest number there is a picture for. Matches the server's cap.</summary>
        public static int MaxId => Icons.Length - 1;

        public static bool IsValid(int id) => id > 0 && id < Icons.Length;

        /// <summary>The atlas name behind a number, for the diagnostic to ask about.</summary>
        public static string NameOf(int id) => IsValid(id) ? Icons[id] : "";

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
