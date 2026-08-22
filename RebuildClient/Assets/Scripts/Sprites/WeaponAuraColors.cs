using RebuildSharedData.Enum.EntityStats;
using UnityEngine;

namespace Assets.Scripts.Sprites
{
    /// <summary>
    /// What colour a weapon's blade glow takes from its element.
    ///
    /// A multiply on top of the glow sprite, so these are tints and not paint: the sprite
    /// underneath is a pale streak of light, and anything too dark here puts it out rather
    /// than colouring it. That is why earth is a warm tan rather than an honest brown - a
    /// brown multiply leaves a muddy smear where a blade used to be.
    ///
    /// Four of these are the elements a blacksmith can forge in. The rest are here because
    /// the same field carries whatever an endow put on the weapon - Aspersio makes it holy,
    /// Enchant Poison makes it poison - and a blade that changes element without changing
    /// colour is worse than one that never changes at all.
    ///
    /// Colours rather than data, because this is a rendering decision and there is nothing
    /// on the other side of the wire that would know better.
    /// </summary>
    public static class WeaponAuraColors
    {
        private static readonly Color Fire = new Color(1.00f, 0.38f, 0.24f);
        private static readonly Color Water = new Color(0.38f, 0.68f, 1.00f);
        private static readonly Color Wind = new Color(0.45f, 1.00f, 0.52f);
        private static readonly Color Earth = new Color(0.86f, 0.62f, 0.34f);
        private static readonly Color Poison = new Color(0.72f, 0.45f, 0.92f);
        private static readonly Color Holy = new Color(1.00f, 0.94f, 0.62f);
        private static readonly Color Dark = new Color(0.45f, 0.35f, 0.62f);
        private static readonly Color Undead = new Color(0.58f, 0.74f, 0.55f);
        private static readonly Color Ghost = new Color(0.72f, 0.92f, 0.96f);

        /// <summary>
        /// The tint for an element, or white for the ones that get none.
        ///
        /// White is the identity of the multiply, so a neutral weapon renders exactly as it
        /// did before any of this existed.
        /// </summary>
        public static Color For(AttackElement element)
        {
            switch (element)
            {
                case AttackElement.Fire: return Fire;
                case AttackElement.Water: return Water;
                case AttackElement.Wind: return Wind;
                case AttackElement.Earth: return Earth;
                case AttackElement.Poison: return Poison;
                case AttackElement.Holy: return Holy;
                case AttackElement.Dark: return Dark;
                case AttackElement.Undead: return Undead;
                case AttackElement.Ghost: return Ghost;
                default: return Color.white;
            }
        }

        /// <summary>Whether an element is worth tinting at all, which saves a pointless write.</summary>
        public static bool HasAura(AttackElement element) => For(element) != Color.white;
    }
}
