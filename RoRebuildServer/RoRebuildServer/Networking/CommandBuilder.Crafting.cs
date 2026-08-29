using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
//OutboundMessage lives under RebuildZoneServer despite sitting in this folder
using RebuildZoneServer.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Simulation.Crafting;
using RoRebuildServer.Simulation.Enchanting;

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
    /// <summary>
    /// Everything this character can currently make with one skill.
    ///
    /// The odds sent are this character's odds with nothing bound in, and the two penalties
    /// go with them so the window can follow a stone or a crumb being picked without asking
    /// again. That is the only arithmetic the client does: everything that decides the
    /// number - the skill levels, the stats, the anvil in the bag - happened here.
    /// </summary>
    public static void SendCraftRecipeList(Player player, CharacterSkill skill, List<ProduceRecipe> recipes)
    {
        var packet = NetworkManager.StartPacket(PacketType.CraftData);
        packet.Write((byte)CraftDataType.RecipeList);
        packet.Write((byte)skill);
        packet.Write((byte)(ForgeSystem.CanBindElement(player) ? 1 : 0));
        packet.Write((byte)ForgeSystem.MaxStarCrumbs);
        packet.Write(DataManager.ItemIdByName.GetValueOrDefault("Star_Crumb", 0));

        //the stones that may go in, so the window has nothing to know about elements
        packet.Write((byte)DataManager.ForgeStones.Count);
        foreach (var stone in DataManager.ForgeStones)
            packet.Write(stone);

        packet.Write((byte)Math.Clamp(recipes.Count, 0, byte.MaxValue));

        foreach (var recipe in recipes)
        {
            packet.Write(recipe.ResultId);
            packet.Write((byte)Math.Clamp(recipe.ResultCount, 0, byte.MaxValue));
            packet.Write(ForgeSystem.CalculateSuccessChance(player, recipe));
            packet.Write(recipe.Zeny);
            packet.Write((byte)(recipe.IsWeapon ? 1 : 0));
            packet.Write(recipe.IsWeapon ? ForgeSystem.ElementStonePenalty : 0);
            packet.Write(recipe.IsWeapon ? ForgeSystem.StarCrumbPenalty : 0);
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
    /// Who forged the weapons this character is carrying.
    ///
    /// Sent beside the items rather than inside them. A UniqueItem is a fixed forty bytes
    /// and every one of them is spoken for, so the name travels as its own small packet
    /// keyed on the guid the item already carries, and the client keeps what it is told.
    ///
    /// Sent whole rather than incrementally because it is cheap - a name is a couple of
    /// dozen bytes and nobody is carrying hundreds of forged weapons - and because an
    /// inventory that has just been replaced wholesale should have its names replaced with
    /// it rather than merged into whatever was there before.
    /// </summary>
    public static void SendForgedNamesForPlayer(Player player)
    {
        if (player.Connection == null)
            return;

        forgedScratch.Clear();
        enchantScratch.Clear();
        CollectBag(player.Inventory);
        CollectBag(player.CartInventory);
        FlushForgedScratch(player);
    }

    /// <summary>One bag's worth, for the storage window and anything else that is not the bag.</summary>
    public static void SendForgedNamesForBag(Player player, CharacterBag? bag)
    {
        if (player.Connection == null || bag == null)
            return;

        forgedScratch.Clear();
        enchantScratch.Clear();
        CollectBag(bag);
        FlushForgedScratch(player);
    }

    private static void CollectBag(CharacterBag? bag)
    {
        if (bag == null)
            return;

        foreach (var (_, item) in bag.UniqueItems)
        {
            var name = ForgedItemRegistry.NameFor(item.UniqueId);
            if (name != null)
                forgedScratch[item.UniqueId] = name;

            if (EnchantRegistry.TryGet(item.UniqueId, out var enchant))
                enchantScratch[item.UniqueId] = enchant;
        }
    }

    /// <summary>
    /// Sends whatever the two scratch dictionaries picked up, and empties nothing.
    /// </summary>
    /// <remarks>
    /// Both side tables ride along with the same calls because they answer the same
    /// question - what does the client need to know about these items that is not in the
    /// items - and every window that shows an item needs both or neither. Hanging the
    /// enchants off these helpers means the eight places that already ask for forged names
    /// did not have to learn about a second thing to ask for.
    ///
    /// Two packets rather than one. The forged name is a string and the options are
    /// numbers, they are read by different windows, and an item usually has one or the
    /// other rather than both.
    /// </remarks>
    private static void FlushForgedScratch(Player player)
    {
        if (forgedScratch.Count > 0)
            SendForgedNames(player, forgedScratch);

        if (enchantScratch.Count > 0)
            SendEnchantedItems(player, enchantScratch);
    }

    /// <summary>
    /// The names behind a set of item guids, for anything that is about to show items the
    /// player does not own - a market page, a shop, a trade window.
    ///
    /// Guids that nobody forged are dropped rather than sent as blanks, so the usual case
    /// of a page with no forged weapons on it sends nothing at all.
    /// </summary>
    public static void SendForgedNamesFor(Player player, IEnumerable<Guid> ids)
    {
        if (player.Connection == null)
            return;

        forgedScratch.Clear();
        enchantScratch.Clear();

        foreach (var id in ids)
        {
            var name = ForgedItemRegistry.NameFor(id);
            if (name != null)
                forgedScratch[id] = name;

            if (EnchantRegistry.TryGet(id, out var enchant))
                enchantScratch[id] = enchant;
        }

        FlushForgedScratch(player);
    }

    /// <summary>One item, for when a single thing arrives rather than the whole bag.</summary>
    public static void SendForgedNameForItem(Player player, ref ItemReference item)
    {
        if (player.Connection == null || item.Type != ItemType.UniqueItem)
            return;

        SendForgedNameForId(player, item.UniqueItem.UniqueId);
    }

    /// <summary>
    /// What is known about one guid, for a window that is showing somebody else's item.
    ///
    /// Silently does nothing when the item was neither forged nor enchanted, which is the
    /// usual answer.
    /// </summary>
    public static void SendForgedNameForId(Player player, Guid uniqueId)
    {
        if (player.Connection == null)
            return;

        forgedScratch.Clear();
        enchantScratch.Clear();

        var name = ForgedItemRegistry.NameFor(uniqueId);
        if (name != null)
            forgedScratch[uniqueId] = name;

        if (EnchantRegistry.TryGet(uniqueId, out var enchant))
            enchantScratch[uniqueId] = enchant;

        FlushForgedScratch(player);
    }

    /// <summary>
    /// One name to everyone who can see it, for a weapon lying on the ground.
    ///
    /// Uses whatever recipient list the caller has already gathered, the same one the drop
    /// packet itself went to - the people who can see the item are exactly the people who
    /// need to be able to read it.
    /// </summary>
    public static void SendForgedNameMulti(Guid uniqueId)
    {
        var name = ForgedItemRegistry.NameFor(uniqueId);
        if (name != null)
        {
            var packet = NetworkManager.StartPacket(PacketType.ForgedNames);
            packet.Write((short)1);
            packet.Write(uniqueId.ToByteArray());
            packet.Write(name);

            NetworkManager.SendMessageMulti(packet, recipients);
        }

        //The options go to the same people for the same reason: whoever can see the item
        //on the ground is whoever might pick it up and want to read it first.
        if (!EnchantRegistry.TryGet(uniqueId, out var enchant))
            return;

        var enchantPacket = NetworkManager.StartPacket(PacketType.EnchantedItems);
        enchantPacket.Write((short)1);
        WriteEnchant(enchantPacket, uniqueId, enchant);

        NetworkManager.SendMessageMulti(enchantPacket, recipients);
    }

    /// <summary>Reused between the two above, which never run at the same time.</summary>
    private static readonly Dictionary<Guid, string> forgedScratch = new();

    /// <summary>The same trick for the options, filled by the same calls.</summary>
    private static readonly Dictionary<Guid, ItemEnchant> enchantScratch = new();

    private static void SendForgedNames(Player player, Dictionary<Guid, string> forged)
    {
        var packet = NetworkManager.StartPacket(PacketType.ForgedNames);
        packet.Write((short)forged.Count);

        foreach (var (id, name) in forged)
        {
            packet.Write(id.ToByteArray());
            packet.Write(name);
        }

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>
    /// The options on a set of items.
    /// </summary>
    /// <remarks>
    /// Stats travel as their enum number rather than their name. The database stores names
    /// because it outlives the build that wrote it and CharacterStat can be renumbered
    /// underneath it; a packet is read by a client built from the same enum in the same
    /// hour, so the two ends cannot disagree and the number is a quarter of the size.
    /// </remarks>
    private static void SendEnchantedItems(Player player, Dictionary<Guid, ItemEnchant> enchants)
    {
        var packet = NetworkManager.StartPacket(PacketType.EnchantedItems);
        packet.Write((short)enchants.Count);

        foreach (var (id, enchant) in enchants)
            WriteEnchant(packet, id, enchant);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>
    /// Tells one player an item has no options any more.
    /// </summary>
    /// <remarks>
    /// Its own call because the ordinary send drops items with nothing on them, which is
    /// right for a market page full of plain gear and wrong for the one item that just had
    /// its options wiped - the client would keep showing what it was told last. An entry
    /// with a count of zero is the client's instruction to forget the item.
    /// </remarks>
    public static void SendEnchantCleared(Player player, Guid uniqueId)
    {
        if (player.Connection == null)
            return;

        var packet = NetworkManager.StartPacket(PacketType.EnchantedItems);
        packet.Write((short)1);
        packet.Write(uniqueId.ToByteArray());
        packet.Write((byte)0); //tier
        packet.Write((byte)0); //no options, which is what makes this a removal

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>
    /// One item's options. The reading half is the client's PacketEnchantedItems, field
    /// for field in this order.
    /// </summary>
    private static void WriteEnchant(OutboundMessage packet, Guid uniqueId, ItemEnchant enchant)
    {
        packet.Write(uniqueId.ToByteArray());
        packet.Write((byte)enchant.Tier);
        packet.Write((byte)enchant.Count);

        for (var i = 0; i < enchant.Count; i++)
        {
            packet.Write((short)enchant.Options[i].Stat);
            packet.Write(enchant.Options[i].Value);
        }
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
