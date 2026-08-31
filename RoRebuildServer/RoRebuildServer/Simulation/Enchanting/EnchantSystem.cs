using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// The parts of enchanting that touch a live player rather than the store.
/// </summary>
/// <remarks>
/// Which scroll is which lives in EnchantScrolls and what a scroll rolls lives in
/// EnchantTables. What is left here is the middle: checking a scroll against the item a
/// player pointed it at, writing the result down, and making a change to something that is
/// already being worn actually show up.
/// </remarks>
public static class EnchantSystem
{
    /// <summary>
    /// Whether a scroll used on this item would do anything, said out loud.
    /// </summary>
    /// <remarks>
    /// Run before the scroll is taken out of the bag, so every no here is a scroll the
    /// player still has. Same split the ordinary item use makes between OnValidate and
    /// OnUse, and for the same reason.
    /// </remarks>
    public static bool CanApplyToItem(Player player, int targetBagId, EnchantScrollSlot slot, bool isBlank) =>
        Validate(player, targetBagId, slot, isBlank, out _, out _);

    /// <summary>
    /// Everything that can refuse a scroll, in one place so the dry run and the real one
    /// can never disagree about what is allowed.
    /// </summary>
    private static bool Validate(Player player, int targetBagId, EnchantScrollSlot slot, bool isBlank,
        out Guid uniqueId, out EnchantSlotFamily family)
    {
        uniqueId = Guid.Empty;
        family = EnchantSlotFamily.None;

        var inventory = player.Inventory;
        if (inventory == null || !inventory.GetItem(targetBagId, out var item))
        {
            CommandBuilder.ErrorMessage(player, "หาของที่จะจารไม่เจอในกระเป๋า");
            return false;
        }

        uniqueId = GuidOf(ref item);
        family = EnchantTables.FamilyOf(item.Id);

        if (uniqueId == Guid.Empty || family == EnchantSlotFamily.None)
        {
            CommandBuilder.ErrorMessage(player, "ใส่ออพได้เฉพาะอาวุธ เกราะ และเครื่องประดับ");
            return false;
        }

        //The blank scroll has no slot of its own - wiping is wiping whatever it is written on.
        if (!isBlank && !CheckSlot(player, ref item, uniqueId, slot))
            return false;

        if (isBlank && !EnchantRegistry.IsEnchanted(uniqueId))
        {
            CommandBuilder.ErrorMessage(player, "ของชิ้นนั้นไม่มีออพให้ล้างอยู่แล้ว");
            return false;
        }

        return true;
    }

    /// <summary>
    /// Whether the item is the kind of thing this scroll names, and on the right side if
    /// the scroll names a side.
    /// </summary>
    /// <remarks>
    /// Two checks rather than one because they fail for different reasons and a player can
    /// only fix the second one. Pointing an armour scroll at a bow is a mistake; pointing a
    /// left accessory scroll at a ring in the bag is a ring that needs putting on first,
    /// and saying so is the difference between a wasted trip and a wasted scroll.
    /// </remarks>
    private static bool CheckSlot(Player player, ref ItemReference item, Guid uniqueId, EnchantScrollSlot slot)
    {
        if (!EnchantScrolls.FitsSlot(item.Id, slot))
        {
            CommandBuilder.ErrorMessage(player, $"คัมภีร์นี้ใช้ได้กับ {EnchantScrolls.NameOf(slot)} เท่านั้น");
            return false;
        }

        var required = EnchantScrolls.RequiredEquipSlot(slot);
        if (required == EquipSlot.None)
            return true;

        if (SlotHolding(player, uniqueId) == required)
            return true;

        var side = slot == EnchantScrollSlot.AccessoryLeft ? "ซ้าย" : "ขวา";
        CommandBuilder.ErrorMessage(player, $"ต้องสวมเครื่องประดับชิ้นนี้ไว้ที่ช่อง{side}ก่อนถึงจะจารได้");
        return false;
    }

    /// <summary>
    /// A scroll used on one chosen item, wherever that item is sitting.
    /// </summary>
    /// <remarks>
    /// Works on anything in the bag rather than only on what is worn, which is the whole
    /// point of letting the player pick - the one exception being the accessory scrolls,
    /// which name a side and so need the ring on. An item that is being worn is refreshed
    /// on the spot; one in the bag picks its options up when it next goes on.
    /// </remarks>
    public static bool TryApplyToItem(Player player, int targetBagId, EnchantTier tier, EnchantScrollSlot slot, bool isBlank)
    {
        if (!Validate(player, targetBagId, slot, isBlank, out var uniqueId, out var family))
            return false;

        var inventory = player.Inventory!;
        inventory.GetItem(targetBagId, out var item);
        var name = DataManager.ItemList.TryGetValue(item.Id, out var data) ? data.Name : item.Id.ToString();

        if (isBlank)
        {
            EnchantRegistry.Clear(uniqueId);
            RefreshIfWorn(player, uniqueId);
            CommandBuilder.SendEnchantCleared(player, uniqueId);
            Announce(player, $"<color=#55FF55>ล้างออพของ {name} เรียบร้อย</color>");
            return true;
        }

        var rolled = EnchantTables.Roll(tier, family);

        EnchantRegistry.Record(uniqueId, rolled);
        RefreshIfWorn(player, uniqueId);

        if (rolled.Count == 0)
        {
            CommandBuilder.SendEnchantCleared(player, uniqueId);
            Announce(player, $"<color=#FF5555>คัมภีร์สลายไปเปล่า ๆ</color> {name} ไม่ได้ออพสักตัว");
            return true;
        }

        CommandBuilder.SendForgedNameForId(player, uniqueId);
        Announce(player, $"<color=#55FF55>จารคัมภีร์ลง {name} สำเร็จ</color>");

        for (var i = 0; i < rolled.Count; i++)
            Announce(player, $"  {rolled.Options[i].Stat} +{rolled.Options[i].Value}");

        ServerLogger.Log($"[Enchant] {player.Name} used a {tier} {slot} scroll and got {rolled.Count} option(s).");
        return true;
    }


    private static void Announce(Player player, string message)
    {
        if (player.Connection == null)
            return;

        CommandBuilder.AddRecipient(player.Connection);
        CommandBuilder.SendServerMessage(message, "");
        CommandBuilder.ClearRecipients();
    }

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
    ///
    /// UpdateStats at the end because equipping does not do it. EquipItem fills the stat
    /// array and stops there; every caller in the server does the recalculation itself -
    /// the equip packet handler, the refine counter, and now this. Without it the options
    /// sit in the array unread: attack, hp and attack speed are all worked out from the
    /// stats during that pass, and the pass also sends the numbers to the client. Skipping
    /// the skill half of it, the same way the refine counter does, since no skill changed.
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

        player.UpdateStats(false);
        return true;
    }
}
