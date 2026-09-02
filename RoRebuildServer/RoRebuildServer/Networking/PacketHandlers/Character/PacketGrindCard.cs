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
        if (player == null)
            return;

        //Same silence the scroll had, for the same reason: the grinder is opened by the
        //scribe, so the player is standing in the one state that blocks it.
        if (!player.CanPerformCharacterActions())
        {
            CommandBuilder.ErrorMessage(player, player.IsInNpcInteraction
                ? "ปิดบทสนทนากับ NPC ให้จบก่อน แล้วค่อยบดการ์ด"
                : "ตอนนี้ยังบดการ์ดไม่ได้ รอสักครู่แล้วลองใหม่");
            return;
        }

        var itemId = msg.ReadInt32();
        var count = msg.ReadInt32();

        player.AddInputActionDelay(InputActionCooldownType.UseItem);

        CardGrindSystem.TryGrind(player, itemId, count);
    }
}
