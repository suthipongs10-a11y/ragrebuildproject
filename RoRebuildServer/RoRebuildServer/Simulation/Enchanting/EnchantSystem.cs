using RebuildSharedData.Enum;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// The parts of enchanting that touch a live player rather than the store.
/// </summary>
/// <remarks>
/// Small for now - it holds the one thing both the test command and, later, the scroll
/// need: making a change to an item that is already being worn actually show up.
/// </remarks>
public static class EnchantSystem
{
    /// <summary>
    /// The guid of a bag item, or empty for a stackable that has none.
    /// </summary>
    /// <remarks>
    /// An ItemReference is either a stack or a single item and only the second kind carries
    /// a guid, so reaching for UniqueItem.UniqueId without checking reads whatever happens
    /// to be in the union - which for a stack of potions is a zeroed struct, and a zeroed
    /// guid would match every other stack in the game.
    /// </remarks>
    public static Guid GuidOf(ref ItemReference item) =>
        item.Type == ItemType.UniqueItem ? item.UniqueItem.UniqueId : Guid.Empty;

    /// <summary>
    /// Which equip slot is holding this item, or None if the player is not wearing it.
    /// </summary>
    public static EquipSlot SlotHolding(Player player, Guid uniqueId)
    {
        var inventory = player.Inventory;
        if (inventory == null || uniqueId == Guid.Empty)
            return EquipSlot.None;

        for (var i = 0; i < 10; i++)
        {
            var bagId = player.Equipment.ItemSlots[i];
            if (bagId <= 0)
                continue;

            if (inventory.GetItem(bagId, out var item) && GuidOf(ref item) == uniqueId)
                return (EquipSlot)i;
        }

        return EquipSlot.None;
    }

    /// <summary>
    /// Makes the options on a worn item take effect, and says whether anything was worn.
    /// </summary>
    /// <remarks>
    /// Taking the item off and putting it back on rather than adding the stats directly.
    /// Every stat an equipped item grants is recorded against its slot so that unequipping
    /// can take it all back off again; adding to that list behind the equip code's back
    /// would work until the player removed the item, at which point the old options would
    /// come off and the new ones would stay on forever.
    ///
    /// Nothing is worn is not a failure. An item sitting in the bag needs no refresh - it
    /// picks its options up the next time it is equipped.
    /// </remarks>
    public static bool RefreshIfWorn(Player player, Guid uniqueId)
    {
        var slot = SlotHolding(player, uniqueId);
        if (slot == EquipSlot.None)
            return false;

        var bagId = player.Equipment.ItemSlots[(int)slot];

        player.Equipment.UnEquipItem(bagId);
        var result = player.Equipment.EquipItem(bagId, slot);

        //It came off a moment ago, so it can go back on. If it somehow cannot, the player
        //is now standing there missing a piece of equipment, which is worth a line in the
        //log rather than leaving somebody to work out why their armour vanished.
        if (result != EquipChangeResult.Success)
            ServerLogger.LogWarning($"Could not re-equip {player.Name}'s {slot} after an enchant change: {result}.");

        return true;
    }
}
