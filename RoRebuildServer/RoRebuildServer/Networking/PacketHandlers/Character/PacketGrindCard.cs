using RebuildSharedData.Networking;
using RoRebuildServer.EntityComponents.Util;
using RoRebuildServer.Simulation.Enchanting;

namespace RoRebuildServer.Networking.PacketHandlers.Character;

/// <summary>
/// A stack of cards handed over to be ground into dust.
/// </summary>
/// <remarks>
/// Carries the item id rather than a bag slot, because cards stack: what a player picks in
/// the window is a kind of card and a number of them, not one particular object.
/// </remarks>
[ClientPacketHandler(PacketType.GrindCard)]
public class PacketGrindCard : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsPlayerAlive)
            return;

        var player = connection.Player;
        if (player == null || !player.CanPerformCharacterActions())
            return;

        var itemId = msg.ReadInt32();
        var count = msg.ReadInt32();

        player.AddInputActionDelay(InputActionCooldownType.UseItem);

        CardGrindSystem.TryGrind(player, itemId, count);
    }
}
