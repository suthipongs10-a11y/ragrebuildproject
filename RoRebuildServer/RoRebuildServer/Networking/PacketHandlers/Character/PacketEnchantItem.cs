using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents.Util;
using RoRebuildServer.Logging;
using RoRebuildServer.Simulation.Enchanting;

namespace RoRebuildServer.Networking.PacketHandlers.Character;

/// <summary>
/// A scroll used on one particular item in the bag.
/// </summary>
/// <remarks>
/// Its own packet rather than a target on UseInventoryItem, because the two are read
/// differently: that one carries an entity id for a person to heal, and this carries a bag
/// slot for a thing to write on.
///
/// The order is the one the ordinary use handler works in and it matters: everything is
/// checked, then the scroll is taken, then the roll happens. Checking after taking would
/// mean a scroll lost to a mistyped target; rolling before taking would mean a player who
/// disliked the result could try again for free.
/// </remarks>
[ClientPacketHandler(PacketType.EnchantItem)]
public class PacketEnchantItem : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsPlayerAlive)
            return;

        var player = connection.Player;
        if (player == null || !player.CanPerformCharacterActions())
            return;

        var scrollId = msg.ReadInt32();
        var targetBagId = msg.ReadInt32();

        player.AddInputActionDelay(InputActionCooldownType.UseItem);

        if (!DataManager.ItemList.TryGetValue(scrollId, out var scroll))
        {
            ServerLogger.LogWarning($"Player {player.Name} tried to enchant with item {scrollId}, which does not exist.");
            return;
        }

        if (!EnchantSystem.TryReadScroll(scroll.Code, out var tier, out var isBlank))
        {
            ServerLogger.LogWarning($"Player {player.Name} tried to enchant with {scroll.Code}, which is not a scroll.");
            return;
        }

        var inventory = player.Inventory;
        if (inventory == null || inventory.GetItemCount(scrollId) <= 0)
        {
            CommandBuilder.ErrorMessage(player, "ไม่มีคัมภีร์ใบนั้นในกระเป๋า");
            return;
        }

        //A scroll cannot be written onto itself, and a target that is gone is a target that
        //was traded away while the window was open.
        if (targetBagId == scrollId || !inventory.GetItem(targetBagId, out _))
        {
            CommandBuilder.ErrorMessage(player, "หาของที่จะจารไม่เจอในกระเป๋า");
            return;
        }

        //Dry run first. TryApplyToItem says no for every reason a player can cause - the
        //wrong kind of item, nothing to wipe - and every one of those should leave the
        //scroll where it is.
        if (!EnchantSystem.CanApplyToItem(player, targetBagId, isBlank))
            return;

        if (!player.TryRemoveItemFromInventory(scrollId, 1))
        {
            CommandBuilder.ErrorMessage(player, "ไม่มีคัมภีร์ใบนั้นในกระเป๋า");
            return;
        }

        CommandBuilder.RemoveItemFromInventory(player, scrollId, 1);

        EnchantSystem.TryApplyToItem(player, targetBagId, tier, isBlank);
    }
}
