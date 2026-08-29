using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// What options are on what item, in memory, so asking is free.
///
/// The whole table is read once at startup and then never read again, the same trade
/// ForgedItemRegistry makes: the options have to be available at the moment an item is
/// equipped and at the moment it is written into a packet, and a query at either of those
/// points would be slower than the thing it was holding up.
///
/// The cost is a guid and up to three small pairs per enchanted item. If this ever needs
/// to hold far more than one server's worth, it wants to become a bounded cache with a
/// lookup behind it, and the shape of this class is meant to make that a local change.
/// </summary>
public static class EnchantRegistry
{
    private static readonly Dictionary<Guid, ItemEnchant> enchants = new();

    public static int Count => enchants.Count;

    /// <summary>Reads the table into memory. Called once, while the server is coming up.</summary>
    public static void Load(RoContext db)
    {
        enchants.Clear();

        var dropped = 0;

        foreach (var row in db.EnchantedItems.AsNoTracking())
        {
            var enchant = new ItemEnchant((EnchantTier)row.Tier);

            if (!TryAdd(enchant, row.Stat1, row.Value1)) dropped++;
            if (!TryAdd(enchant, row.Stat2, row.Value2)) dropped++;
            if (!TryAdd(enchant, row.Stat3, row.Value3)) dropped++;

            if (enchant.Count > 0)
                enchants[row.UniqueId] = enchant;
        }

        if (enchants.Count > 0)
            ServerLogger.Log($"Loaded enchant options on {enchants.Count} item(s).");

        //A stat name that no longer parses means the enum lost a member, which is the one
        //failure this design cannot silently absorb. Say so loudly rather than handing the
        //player an item that quietly lost an option.
        if (dropped > 0)
            ServerLogger.LogWarning($"Dropped {dropped} enchant option(s) naming a stat that no longer exists.");
    }

    /// <summary>
    /// Adds one stored pair, and says whether it was understood.
    /// </summary>
    /// <remarks>
    /// An empty name is an empty slot rather than a failure - every item with fewer than
    /// three options stores the rest as blanks - so it counts as understood.
    /// </remarks>
    private static bool TryAdd(ItemEnchant enchant, string statName, int value)
    {
        if (string.IsNullOrEmpty(statName) || value == 0)
            return true;

        if (!System.Enum.TryParse<CharacterStat>(statName, out var stat))
            return false;

        enchant.Add(stat, value);
        return true;
    }

    /// <summary>
    /// Puts a block of options on an item, replacing whatever was there.
    ///
    /// Memory now, database when the queue gets to it, so the item reads correctly the
    /// instant the scroll is used.
    /// </summary>
    public static void Record(Guid uniqueId, ItemEnchant enchant)
    {
        if (uniqueId == Guid.Empty)
            return;

        if (enchant.Count == 0)
        {
            Clear(uniqueId);
            return;
        }

        enchants[uniqueId] = enchant;
        RoDatabase.EnqueueDbRequest(new EnchantItemRecordRequest(uniqueId, enchant, DateTime.UtcNow));
    }

    /// <summary>Takes every option off an item. What the blank scroll does.</summary>
    public static void Clear(Guid uniqueId)
    {
        if (uniqueId == Guid.Empty || !enchants.Remove(uniqueId))
            return;

        RoDatabase.EnqueueDbRequest(new EnchantItemClearRequest(uniqueId));
    }

    public static bool TryGet(Guid uniqueId, [NotNullWhen(true)] out ItemEnchant? enchant)
    {
        if (uniqueId != Guid.Empty)
            return enchants.TryGetValue(uniqueId, out enchant);

        enchant = null;
        return false;
    }

    public static bool IsEnchanted(Guid uniqueId) => uniqueId != Guid.Empty && enchants.ContainsKey(uniqueId);
}
