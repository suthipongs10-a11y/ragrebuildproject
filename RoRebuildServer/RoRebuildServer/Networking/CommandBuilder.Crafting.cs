using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
//OutboundMessage lives under RebuildZoneServer despite sitting in this folder
using RebuildZoneServer.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Simulation.Crafting;

namespace RoRebuildServer.Networking;

/// <summary>
/// What the forge sends down the wire.
///
/// The recipe list is sent rather than shipped with the client on purpose: the odds on it
/// are this character's odds, worked out here, so the window never has a formula in it
/// that could drift from the one the server actually rolls against.
///
/// The reading half lives in the client's PacketCraftData, field for field in the same
/// order - a field added to one and not the other turns everything after it into nonsense
/// rather than failing.
/// </summary>
public static partial class CommandBuilder
{
    /// <summary>Everything this character can currently make with one skill.</summary>
    public static void SendCraftRecipeList(Player player, CharacterSkill skill, List<ProduceRecipe> recipes)
    {
        var packet = NetworkManager.StartPacket(PacketType.CraftData);
        packet.Write((byte)CraftDataType.RecipeList);
        packet.Write((byte)skill);
        packet.Write((byte)Math.Clamp(recipes.Count, 0, byte.MaxValue));

        foreach (var recipe in recipes)
        {
            packet.Write(recipe.ResultId);
            packet.Write((byte)Math.Clamp(recipe.ResultCount, 0, byte.MaxValue));
            packet.Write(ForgeSystem.CalculateSuccessChance(player, recipe));
            packet.Write(recipe.Zeny);
            packet.Write((byte)recipe.Materials.Length);

            foreach (var material in recipe.Materials)
            {
                packet.Write(material.ItemId);
                packet.Write((short)material.Count);
            }
        }

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>
    /// How one attempt went.
    ///
    /// The item is named even on a failure so the window can say what was lost rather than
    /// only that something was.
    /// </summary>
    public static void SendCraftResult(Player player, CraftResult result, int resultId, int resultCount)
    {
        var packet = NetworkManager.StartPacket(PacketType.CraftData);
        packet.Write((byte)CraftDataType.Result);
        packet.Write((byte)result);
        packet.Write(resultId);
        packet.Write((byte)Math.Clamp(resultCount, 0, byte.MaxValue));

        NetworkManager.SendMessage(packet, player.Connection);
    }
}
