using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
//OutboundMessage lives under RebuildZoneServer despite sitting in this folder
using RebuildZoneServer.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
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
        }
    }

    private static void FlushForgedScratch(Player player)
    {
        if (forgedScratch.Count > 0)
            SendForgedNames(player, forgedScratch);
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

        foreach (var id in ids)
        {
            var name = ForgedItemRegistry.NameFor(id);
            if (name != null)
                forgedScratch[id] = name;
        }

        FlushForgedScratch(player);
    }

    /// <summary>One item, for when a single thing arrives rather than the whole bag.</summary>
    public static void SendForgedNameForItem(Player player, ref ItemReference item)
    {
        if (player.Connection == null || item.Type != ItemType.UniqueItem)
            return;

        var name = ForgedItemRegistry.NameFor(item.UniqueItem.UniqueId);
        if (name == null)
            return;

        forgedScratch.Clear();
        forgedScratch[item.UniqueItem.UniqueId] = name;
        SendForgedNames(player, forgedScratch);
    }

    /// <summary>
    /// The name behind one guid, for a window that is showing somebody else's item.
    ///
    /// Silently does nothing when nobody forged it, which is the usual answer.
    /// </summary>
    public static void SendForgedNameForId(Player player, Guid uniqueId)
    {
        if (player.Connection == null)
            return;

        var name = ForgedItemRegistry.NameFor(uniqueId);
        if (name == null)
            return;

        forgedScratch.Clear();
        forgedScratch[uniqueId] = name;
        SendForgedNames(player, forgedScratch);
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
        if (name == null)
            return;

        var packet = NetworkManager.StartPacket(PacketType.ForgedNames);
        packet.Write((short)1);
        packet.Write(uniqueId.ToByteArray());
        packet.Write(name);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    /// <summary>Reused between the two above, which never run at the same time.</summary>
    private static readonly Dictionary<Guid, string> forgedScratch = new();

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
