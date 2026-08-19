using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Assets.Scripts.Sprites;
using Assets.Scripts.Utility;

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

        /// <summary>
        /// The bosses, as their card artwork.
        ///
        /// A monster is an animated sprite file, not a picture, so there is no boss portrait
        /// in any atlas - but every one of these has a card, and a card has artwork of the
        /// thing it came from. Thirty two of them, which is every boss whose card the client
        /// ships an illustration for.
        ///
        /// These load one at a time from disk rather than out of the atlas, so they cannot
        /// be handed back from a function the way the others are - see LoadInto.
        /// </summary>
        private static readonly string[] BossCards =
        {
            "Ghostring_Card",       // 61
            "Angeling_Card",        // 62
            "Deviling_Card",        // 63
            "Archangeling_Card",    // 64
            "Baphomet_Card",        // 65
            "Dracula_Card",         // 66
            "Osiris_Card",          // 67
            "Amon_Ra_Card",         // 68
            "Pharaoh_Card",         // 69
            "Doppelganger_Card",    // 70
            "Dark_Lord_Card",       // 71
            "Dark_Illusion_Card",   // 72
            "Dark_Priest_Card",     // 73
            "Eddga_Card",           // 74
            "Phreeoni_Card",        // 75
            "Mistress_Card",        // 76
            "Orc_Lord_Card",        // 77
            "Drake_Card",           // 78
            "Maya_Card",            // 79
            "Gryphon_Card",         // 80
            "Dragon_Fly_Card",      // 81
            "Vagabond_Wolf_Card",   // 82
            "Mastering_Card",       // 83
            "Owl_Duke_Card",        // 84
            "Owl_Baron_Card",       // 85
            "Executioner_Card",     // 86
            "Eclipse_Card",         // 87
            "Chimera_Card",         // 88
            "Tao_Gunka_Card",       // 89
            "Turtle_General_Card",  // 90
            "Toad_Card",            // 91
            "Bloody_Knight_Card",   // 92
        };

        /// <summary>Boss art already fetched, so it is fetched once and not per name plate.</summary>
        private static readonly Dictionary<int, Sprite> BossArt = new();

        /// <summary>Where the numbered bosses start.</summary>
        private const int FirstBossId = 61;

        /// <summary>The highest number there is a picture for. Matches the server's cap.</summary>
        public static int MaxId => Icons.Length - 1 + BossCards.Length;

        public static bool IsValid(int id) => id > 0 && id <= MaxId;

        private static bool IsBoss(int id) => id >= FirstBossId && id <= MaxId;

        /// <summary>Whether this number is one of the bosses, whose picture arrives late.</summary>
        public static bool IsBossEmblem(int id) => IsValid(id) && IsBoss(id);

        /// <summary>The atlas name behind a number, for the diagnostic to ask about.</summary>
        public static string NameOf(int id)
        {
            if (!IsValid(id))
                return "";

            return IsBoss(id) ? BossCards[id - FirstBossId] : Icons[id];
        }

        /// <summary>
        /// Puts an emblem into an Image, whichever kind it is.
        ///
        /// The two kinds do not arrive the same way. An icon is already in an atlas that is
        /// in memory, so it can be handed back; a boss is a card illustration loaded from
        /// disk when it is asked for, and there is nothing to hand back until it arrives.
        /// Callers get this instead of a sprite, so neither of them has to know which.
        ///
        /// The target is checked again when the load returns: a picker rebuilt while a
        /// picture was in flight would otherwise write into a destroyed object.
        /// </summary>
        public static void LoadInto(Image target, int id)
        {
            if (target == null)
                return;

            if (!IsValid(id))
            {
                target.enabled = false;
                return;
            }

            if (!IsBoss(id))
            {
                var sprite = Sprite(id);
                target.enabled = sprite != null;
                target.sprite = sprite;
                return;
            }

            //Asked for once and remembered after. A name plate refreshes its emblem every
            //time anything on it changes, and every character on screen has one - without
            //this, walking past a guild would start a fresh load on each of them.
            if (BossArt.TryGetValue(id, out var cached))
            {
                target.sprite = cached;
                target.enabled = cached != null;
                return;
            }

            //hidden until it arrives, rather than showing a white box for a frame or two
            target.enabled = false;

            var path = $"Assets/Sprites/Imported/Collections/cardart_{BossCards[id - FirstBossId]}.png";
            AddressableUtility.LoadSprite(target.gameObject, path,
                loaded =>
                {
                    //a miss is remembered too, so a card whose art was never imported is
                    //looked for once instead of on every refresh for the rest of the session
                    BossArt[id] = loaded;

                    if (target == null || loaded == null)
                        return;

                    target.sprite = loaded;
                    target.enabled = true;
                },
                () => { /* no art for that card; the cell simply stays empty */ });
        }

        /// <summary>
        /// The picture for a number, or null for none and for anything out of range.
        ///
        /// Out of range answers the same as none rather than throwing: the number arrives
        /// over the network, and a client one version behind the server would otherwise
        /// die on a guild that picked an emblem it has never heard of.
        /// </summary>
        public static Sprite Sprite(int id)
        {
            //A boss is not in the atlas at all, so there is nothing to return for one. Use
            //LoadInto, which handles both kinds.
            if (!IsValid(id) || IsBoss(id))
                return null;

            var loader = ClientDataLoader.Instance;
            return loader == null ? null : loader.GetIconAtlasSprite(Icons[id]);
        }
    }
}
