using System.Diagnostics;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.Simulation.Crafting;

namespace RoRebuildServer.Networking.PacketHandlers.Crafting;

/// <summary>
/// Everything the forge window asks for, behind one packet with an action byte.
///
/// Nothing the client sends is trusted past the two values it names - which skill and
/// which item. What that recipe costs, what it needs and what the odds are all come from
/// the server's own copy, so a client asking to make oridecon out of nothing is answered
/// with the real recipe's requirements and turned down by them.
/// </summary>
[ClientPacketHandler(PacketType.CraftAction)]
public class PacketCraftAction : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsPlayerAlive)
            return;

        Debug.Assert(connection.Player != null);

        var player = connection.Player;
        var action = (CraftRequestType)msg.ReadByte();
        var skill = (CharacterSkill)msg.ReadByte();

        //A skill that is not a crafting skill has no list and cannot make anything, so
        //both actions end here rather than each checking it again further down.
        if (!CraftingSkills.IsCraftingSkill(skill))
            return;

        switch (action)
        {
            case CraftRequestType.RecipeList:
            {
                //Only what this character has levelled far enough to make. A list of
                //things greyed out would only be a list of things to ask about.
                var known = new List<ProduceRecipe>();
                var recipes = DataManager.GetProduceRecipesForSkill(skill);

                if (recipes != null && player.MaxLearnedLevelOfSkill(skill) > 0)
                {
                    foreach (var recipe in recipes)
                        if (ForgeSystem.CanSeeRecipe(player, recipe))
                            known.Add(recipe);
                }

                CommandBuilder.SendCraftRecipeList(player, skill, known);
                break;
            }

            case CraftRequestType.Craft:
            {
                var resultId = msg.ReadInt32();
                var stoneId = msg.ReadInt32();
                var starCrumbs = msg.ReadByte();

                if (!player.CanPerformCharacterActions())
                    return;

                var recipeCount = 1;
                if (DataManager.TryGetProduceRecipe(skill, resultId, out var recipe))
                    recipeCount = recipe.ResultCount;

                var result = ForgeSystem.AttemptCraft(player, skill, resultId, stoneId, starCrumbs);

                CommandBuilder.SendCraftResult(player, result, resultId,
                    result == CraftResult.Success ? recipeCount : 0);

                if (result != CraftResult.Success && result != CraftResult.Failed)
                    return;

                var recipients = player.Character.GetVisiblePlayerList();
                if (recipients == null)
                    return;

                //The refine effects stand in until the forge has its own: they are already
                //"a thing was made" and "a thing was lost", which is what happened.
                CommandBuilder.AddRecipients(recipients);
                CommandBuilder.SendEffectOnCharacterMulti(player.Character,
                    DataManager.EffectIdForName[result == CraftResult.Success ? "RefineSuccess" : "RefineFailure"]);
                CommandBuilder.ClearRecipients();

                break;
            }
        }
    }
}
