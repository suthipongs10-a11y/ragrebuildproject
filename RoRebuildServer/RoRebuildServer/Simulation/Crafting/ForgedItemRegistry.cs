using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Simulation.Crafting;

/// <summary>
/// Who forged what, in memory, so asking is free.
///
/// The whole table is read once at startup and then never read again. That is a deliberate
/// trade: a name has to be available at the moment an item is written into a packet, and
/// every alternative to holding them all - a query per item, a request/answer pair with the
/// client, a name carried in the item itself - was either slower than the packet it was
/// holding up or a change to how every unique item goes down the wire.
///
/// The cost is a guid and a short string per weapon ever forged. Ten thousand of them is
/// about a megabyte, which is the right shape of number for a server one person runs. If
/// this ever needs to hold a hundred times that, it wants to become a bounded cache with
/// a lookup behind it, and the shape of this class is meant to make that a local change.
/// </summary>
public static class ForgedItemRegistry
{
    private static readonly Dictionary<Guid, string> names = new();

    /// <summary>Reads the table into memory. Called once, while the server is coming up.</summary>
    public static void Load(RoContext db)
    {
        names.Clear();

        foreach (var row in db.ForgedItems.AsNoTracking())
            names[row.UniqueId] = row.ForgerName;

        if (names.Count > 0)
            ServerLogger.Log($"Loaded {names.Count} forged item(s).");
    }

    /// <summary>
    /// Records a weapon as this character's work.
    ///
    /// The name goes into memory now and into the database when the queue gets to it, so
    /// the weapon reads correctly the instant it lands in the bag.
    /// </summary>
    public static void Record(Guid uniqueId, Guid forgerId, string forgerName)
    {
        if (uniqueId == Guid.Empty || string.IsNullOrEmpty(forgerName))
            return;

        names[uniqueId] = forgerName;

        RoDatabase.EnqueueDbRequest(new ForgedItemRecordRequest(uniqueId, forgerId, forgerName, DateTime.UtcNow));
    }

    /// <summary>The smith who made it, or nothing if it was not forged by anyone.</summary>
    public static string? NameFor(Guid uniqueId) =>
        uniqueId != Guid.Empty && names.TryGetValue(uniqueId, out var name) ? name : null;

    public static bool IsForged(Guid uniqueId) => uniqueId != Guid.Empty && names.ContainsKey(uniqueId);
}
