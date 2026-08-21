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
            Received = false;
            HasResult = false;
            Touch();
        }
    }
}
