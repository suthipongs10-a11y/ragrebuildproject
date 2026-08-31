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
/// Small for now - it holds the one thing both the test command and, later, the scroll
/// need: making a change to an item that is already being worn actually show up.
/// </remarks>
public static class EnchantSystem
{
    /// <summary>
    /// Which slots each kind of scroll looks at, in the order it looks at them.
    /// </summary>
    /// <remarks>
    /// The scroll names the family, so there is no window asking the player which item they
    /// meant - the weapon scroll goes on the weapon and that is the end of it. Two families
    /// cover more than one slot, and those take the first slot that has something in it. A
    /// player wearing two hats who wants the other one enchanted takes the first one off,
    /// which is a smaller thing to ask than an item picker is to build.
    ///
    /// Names rather than an enum because these are typed into the item script by hand, and
    /// a misspelling should be a warning in the log rather than a compiler error in a file
    /// the compiler never sees.
    /// </remarks>
    private static readonly (string Name, EquipSlot[] Slots)[] families =
    [
        ("Headgear", [EquipSlot.HeadTop, EquipSlot.HeadMid, EquipSlot.HeadBottom]),
        ("Body", [EquipSlot.Body]),
        ("Weapon", [EquipSlot.RightHand]),
        ("Shield", [EquipSlot.LeftHand]),
        ("Garment", [EquipSlot.Garment]),
        ("Shoes", [EquipSlot.Footgear]),
        ("Accessory", [EquipSlot.Accessory1, EquipSlot.Accessory2])
    ];

    /// <summary>What a scroll of this family would land on, if anything.</summary>
    public static bool TryFindTarget(Player player, string familyName, out EquipSlot slot, out Guid uniqueId, out int itemId)
    {
        slot = EquipSlot.None;
        uniqueId = Guid.Empty;
        itemId = 0;

        var inventory = player.Inventory;
        if (inventory == null)
            return false;

        foreach (var (name, slots) in families)
        {
            if (!string.Equals(name, familyName, StringComparison.OrdinalIgnoreCase))
                continue;

            foreach (var candidate in slots)
            {
                var bagId = player.Equipment.ItemSlots[(int)candidate];
                if (bagId <= 0 || !inventory.GetItem(bagId, out var item))
                    continue;

                var guid = GuidOf(ref item);
                if (guid == Guid.Empty)
                    continue;

                slot = candidate;
                uniqueId = guid;
                itemId = item.Id;
                return true;
            }

            return false; //the family exists and nothing in it is wearable
        }

        ServerLogger.LogWarning($"An enchant scroll named the slot family '{familyName}', which is not one of the seven.");
        return false;
    }

    /// <summary>
    /// Whether using a scroll of this family would do anything, said out loud.
    /// </summary>
    /// <remarks>
    /// Called before the scroll is taken out of the bag, so every no here is a scroll the
    /// player still has. The reason is always given: an item that refuses silently gets
    /// clicked again.
    /// </remarks>
    public static bool CanUseScroll(Player player, string familyName)
    {
        if (!TryFindTarget(player, familyName, out _, out _, out _))
        {
            CommandBuilder.ErrorMessage(player, $"ต้องสวมของในตำแหน่งนั้นก่อนถึงจะใช้คัมภีร์ได้");
            return false;
        }

        return true;
    }

    /// <summary>
    /// One scroll, used.
    /// </summary>
    /// <remarks>
    /// The scroll has already been taken by the time this runs - that is the order the use
    /// handler works in, and it is the right one: a roll that comes back empty still costs
    /// the scroll, which is what makes it a gamble.
    /// </remarks>
    public static void UseScroll(Player player, string familyName, EnchantTier tier)
    {
        if (!TryFindTarget(player, familyName, out var slot, out var uniqueId, out var itemId))
        {
            CommandBuilder.ErrorMessage(player, "คัมภีร์สลายไปโดยไม่มีอะไรให้จาร");
            return;
        }

        var family = EnchantTables.FamilyOf(itemId);
        if (family == EnchantSlotFamily.None)
        {
            CommandBuilder.ErrorMessage(player, "ของชิ้นนี้ใส่ออพไม่ได้");
            return;
        }

        var rolled = EnchantTables.Roll(tier, family);

        EnchantRegistry.Record(uniqueId, rolled);
        RefreshIfWorn(player, uniqueId);

        var name = DataManager.ItemList.TryGetValue(itemId, out var data) ? data.Code : itemId.ToString();

        if (rolled.Count == 0)
        {
            CommandBuilder.SendEnchantCleared(player, uniqueId);
            Announce(player, $"<color=#FF5555>คัมภีร์สลายไปเปล่า ๆ</color> {name} ไม่ได้ออพสักตัว");
            return;
        }

        CommandBuilder.SendForgedNameForId(player, uniqueId);
        Announce(player, $"<color=#55FF55>จารคัมภีร์ลง {name} ({slot}) สำเร็จ</color>");

        for (var i = 0; i < rolled.Count; i++)
            Announce(player, $"  {rolled.Options[i].Stat} +{rolled.Options[i].Value}");

        ServerLogger.Log($"[Enchant] {player.Name} used a {tier} scroll on their {slot} and got {rolled.Count} option(s).");
    }

    /// <summary>
    /// Wipes the options off the first enchanted thing the player is wearing.
    /// </summary>
    /// <remarks>
    /// One blank scroll for all seven slots rather than seven of them. Wiping is not a
    /// gamble - there is no roll and no tier - so making somebody carry the right one of
    /// seven buys nothing but a fuller bag.
    ///
    /// It walks the families in the order they are declared and takes the first one that
    /// has options on it, and says which item it landed on. Somebody who wants a specific
    /// piece wiped takes the ones above it off first, the same rule the headgear scroll
    /// already works by.
    ///
    /// Worth knowing: re-rolling does not need this. A scroll replaces the whole block, so
    /// the only reason to wipe is to hand somebody a clean item.
    /// </remarks>
    public static void BlankScroll(Player player)
    {
        if (!TryFindEnchanted(player, out var slot, out var uniqueId, out var itemId))
        {
            CommandBuilder.ErrorMessage(player, "คัมภีร์สลายไปโดยไม่มีอะไรให้ล้าง");
            return;
        }

        var name = DataManager.ItemList.TryGetValue(itemId, out var data) ? data.Code : itemId.ToString();

        EnchantRegistry.Clear(uniqueId);
        RefreshIfWorn(player, uniqueId);
        CommandBuilder.SendEnchantCleared(player, uniqueId);
        Announce(player, $"<color=#55FF55>ล้างออพของ {name} ({slot}) เรียบร้อย</color>");
        ServerLogger.Log($"[Enchant] {player.Name} wiped the options off their {slot}.");
    }

    /// <summary>Whether the player is wearing anything with options on it at all.</summary>
    public static bool CanUseBlankScroll(Player player)
    {
        if (TryFindEnchanted(player, out _, out _, out _))
            return true;

        CommandBuilder.ErrorMessage(player, "ตอนนี้ไม่ได้สวมของที่มีออพอยู่สักชิ้น");
        return false;
    }

    /// <summary>The first worn item carrying options, walking the families in order.</summary>
    private static bool TryFindEnchanted(Player player, out EquipSlot slot, out Guid uniqueId, out int itemId)
    {
        foreach (var (name, _) in families)
        {
            if (!TryFindTarget(player, name, out slot, out uniqueId, out itemId))
                continue;

            if (EnchantRegistry.IsEnchanted(uniqueId))
                return true;
        }

        slot = EquipSlot.None;
        uniqueId = Guid.Empty;
        itemId = 0;
        return false;
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
