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
    /// <summary>What a weapon says about the person who made it.</summary>
    public readonly record struct ForgedEntry(string Name, int Rank);

    private static readonly Dictionary<Guid, ForgedEntry> entries = new();

    /// <summary>
    /// Running total of what each smith has made, so a rank never costs a query.
    /// </summary>
    /// <remarks>
    /// Summed while the table is being read for the names anyway, which makes it free. It
    /// is keyed on the character guid rather than the name for the reason the name is a
    /// copy in the first place: a smith can rename, and their standing should follow them
    /// rather than stay with whatever they used to be called.
    /// </remarks>
    private static readonly Dictionary<Guid, int> fameByForger = new();

    /// <summary>Reads the table into memory. Called once, while the server is coming up.</summary>
    public static void Load(RoContext db)
    {
        entries.Clear();
        fameByForger.Clear();

        foreach (var row in db.ForgedItems.AsNoTracking())
        {
            entries[row.UniqueId] = new ForgedEntry(row.ForgerName, row.ForgerRank);

            if (row.FamePoints > 0 && row.ForgerId != Guid.Empty)
                fameByForger[row.ForgerId] = fameByForger.GetValueOrDefault(row.ForgerId) + row.FamePoints;
        }

        if (entries.Count > 0)
            ServerLogger.Log($"Loaded {entries.Count} forged item(s) across {fameByForger.Count} smith(s).");
    }

    /// <summary>
    /// Records a weapon as this character's work.
    ///
    /// The name goes into memory now and into the database when the queue gets to it, so
    /// the weapon reads correctly the instant it lands in the bag.
    /// </summary>
    public static void Record(Guid uniqueId, Guid forgerId, string forgerName, int forgerRank, int famePoints)
    {
        if (uniqueId == Guid.Empty || string.IsNullOrEmpty(forgerName))
            return;

        entries[uniqueId] = new ForgedEntry(forgerName, forgerRank);

        //The points land after the rank has been read off, so a weapon never counts towards
        //its own title. The one that takes a smith over the line is the first one to say so.
        if (famePoints > 0 && forgerId != Guid.Empty)
            fameByForger[forgerId] = FameFor(forgerId) + famePoints;

        RoDatabase.EnqueueDbRequest(new ForgedItemRecordRequest(uniqueId, forgerId, forgerName, forgerRank, famePoints, DateTime.UtcNow));
    }

    /// <summary>The smith who made it, or nothing if it was not forged by anyone.</summary>
    public static string? NameFor(Guid uniqueId) =>
        uniqueId != Guid.Empty && entries.TryGetValue(uniqueId, out var entry) ? entry.Name : null;

    /// <summary>What the smith's standing was when they made it. Zero for an unranked one.</summary>
    public static int RankFor(Guid uniqueId) =>
        uniqueId != Guid.Empty && entries.TryGetValue(uniqueId, out var entry) ? entry.Rank : 0;

    /// <summary>Everything one smith has earned, across every weapon they have ever made.</summary>
    public static int FameFor(Guid forgerId) =>
        forgerId != Guid.Empty && fameByForger.TryGetValue(forgerId, out var fame) ? fame : 0;

    public static bool IsForged(Guid uniqueId) => uniqueId != Guid.Empty && entries.ContainsKey(uniqueId);
}
