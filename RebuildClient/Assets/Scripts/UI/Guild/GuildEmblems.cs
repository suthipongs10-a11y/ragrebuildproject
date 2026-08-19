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
    /// The item names are Korean because that is what the item data calls them, and the
    /// atlas is keyed by exactly that. They are not translations and must not be edited:
    /// change one and the picture is simply not found.
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

            //Legendary blades, all rank 4. Two of them - Mysteltainn and Tyrfing - are the
            //names of bosses as well as of weapons, which is as close to a boss portrait as
            //this can get: monsters are animated sprite files rendered by their own
            //renderer, not flat pictures in the icon atlas, so there is nothing to put in
            //an Image for them.
            "엑스칼리버",              // 31 Excalibur
            "무라마사",               // 32 Muramasa
            "마사무네",               // 33 Masamune
            "발뭉",                 // 34 Balmung
            "미스틸테인",              // 35 Mistilteinn
            "테일핑",                // 36 Tyrfing
            "드래곤슬레이어",            // 37 Dragon Slayer
            "네이건",                // 38 Nagan
            "아이스팔시온",             // 39 Ice Falchion
            "화이어브랜드",             // 40 Fire Brand

            //the rest of the rank 4 armoury, one of each kind
            "궁그닐",                // 41 Gungnir
            "크레센트사이더",            // 42 Crescent Scythe
            "블러드액스",              // 43 Bloody Axe
            "등뒤를베는자",             // 44 Infiltrator
            "카이저너클",              // 45 Kaiser Knuckle
            "발리스타",               // 46 Ballista
            "위자드리스태프",            // 47 Wizardry Staff
            "묵시록",                // 48 Book of the Apocalypse
            "풍마_대차륜",             // 49 Huuma Giant Wheel Shuriken
            "카운터단검",              // 50 Dagger of Counter
            "골든메이스",              // 51 Golden Mace

            //headgear worth looking at, including one an MVP wears
            "오크히어로투구",            // 52 Orc Hero Helm
            "발키리투구",              // 53 Valkyrian Helm
            "프리카서클릿",             // 54 Fricca's Circlet
            "모르피셔스두건",            // 55 Morpheus's Hood
            "모리아네헬름",             // 56 Morrigane's Helm
            "게브네이투구",             // 57 Goibne's Helm
            "사자탈",                // 58 Mythical Lion Mask
            "각시탈",                // 59 Bride Mask
            "검은고양이귀",             // 60 Black Cat Ears
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
