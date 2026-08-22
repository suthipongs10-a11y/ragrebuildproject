using System.Collections.Generic;
using RebuildSharedData.Enum;

namespace Assets.Scripts.Network
{
    /// <summary>One material a recipe eats, as it came off the wire.</summary>
    public class ForgeMaterial
    {
        public int ItemId;
        public int Count;
    }

    /// <summary>One thing a crafting skill can make.</summary>
    public class ForgeRecipe
    {
        public int ResultId;
        public int ResultCount;

        /// <summary>
        /// This character's odds on this recipe, in ten-thousandths.
        ///
        /// Worked out by the server and sent, never worked out here - the window must not
        /// have a formula in it that could drift from the one actually rolled against.
        /// </summary>
        public int Chance;

        public int Zeny;
        public readonly List<ForgeMaterial> Materials = new List<ForgeMaterial>();

        /// <summary>Whether a stone and star crumbs can go into this one.</summary>
        public bool IsWeapon;

        /// <summary>What binding an element costs in odds, sent so the window can follow it.</summary>
        public int ElementPenalty;

        /// <summary>What each star crumb costs in odds.</summary>
        public int CrumbPenalty;

        /// <summary>The odds with what is currently picked, on the same ten-thousandth scale.</summary>
        public int ChanceWith(bool stone, int crumbs)
        {
            var chance = Chance - (stone ? ElementPenalty : 0) - crumbs * CrumbPenalty;
            return chance < 0 ? 0 : chance;
        }
    }

    /// <summary>
    /// What the forge window is showing, filled in by PacketCraftData.
    ///
    /// The same shape MarketState uses: a revision the window compares against what it
    /// last drew, so an answer arriving redraws the page without an event holding a
    /// reference to a window that may since have been destroyed.
    /// </summary>
    public static class ForgeState
    {
        /// <summary>Which skill the list on screen belongs to.</summary>
        public static CharacterSkill Skill = CharacterSkill.None;

        public static readonly List<ForgeRecipe> Recipes = new List<ForgeRecipe>();

        /// <summary>Whether this character has Weapon Binding, which is what buys the stone slot.</summary>
        public static bool CanBindElement;

        /// <summary>How many star crumbs one weapon will take.</summary>
        public static int MaxStarCrumbs;

        /// <summary>Which item a star crumb is, so the window can count them in the bag.</summary>
        public static int StarCrumbId;

        /// <summary>The stones that may be bound in, in the order to show them.</summary>
        public static readonly List<int> Stones = new List<int>();

        /// <summary>Whether an answer has arrived at all, so the window can say "asking".</summary>
        public static bool Received;

        /// <summary>How the last attempt went, for the line under the list.</summary>
        public static CraftResult LastResult = CraftResult.Success;
        public static int LastResultItem;
        public static int LastResultCount;

        /// <summary>Whether there has been an attempt to report since the window opened.</summary>
        public static bool HasResult;

        public static int Revision { get; private set; }

        public static void Touch() => Revision++;

        /// <summary>
        /// Forgotten on logout, and when a different skill is asked about.
        ///
        /// Clearing on the ask rather than on the answer means the window cannot briefly
        /// draw one skill's recipes under another skill's title.
        /// </summary>
        public static void Clear()
        {
            Skill = CharacterSkill.None;
            Recipes.Clear();
            Stones.Clear();
            CanBindElement = false;
            MaxStarCrumbs = 0;
            StarCrumbId = 0;
            Received = false;
            HasResult = false;
            Touch();
        }
    }
}
