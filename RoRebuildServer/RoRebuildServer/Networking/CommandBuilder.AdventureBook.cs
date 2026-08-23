using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
//OutboundMessage lives under RebuildZoneServer despite sitting in this folder
using RebuildZoneServer.Networking;
using RoRebuildServer.Custom.AdventureBook;
using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Networking;

/// <summary>
/// What the adventure book sends down the wire.
///
/// The reading half is the client's PacketAdventureBookData, field for field in the same
/// order - a field added to one and not the other turns everything after it into nonsense
/// rather than failing.
/// </summary>
public static partial class CommandBuilder
{
    /// <summary>How many places to name for one monster. The window is a page, not an atlas.</summary>
    private const int MaxSightingsSent = 4;

    /// <summary>
    /// How many bytes of pages to put in one packet.
    /// </summary>
    /// <remarks>
    /// OutboundMessage starts at a kilobyte and doubles until the next doubling would pass
    /// ten thousand bytes, at which point it asserts - which is a hard stop that takes the
    /// whole server down, not a dropped packet. The capacity argument StartPacket accepts is
    /// ignored, so there is no way to ask for a bigger one. That leaves eight kilobytes as
    /// the real ceiling, and well under a quarter of it leaves room for the estimate above to
    /// be wrong without anybody finding out the expensive way.
    /// </remarks>
    private const int BatchByteBudget = 1800;

    /// <summary>
    /// The whole book and one character's place in it, in as many packets as it takes.
    /// </summary>
    /// <remarks>
    /// Split because OutboundMessage refuses to grow past a few thousand bytes and asserts
    /// rather than truncating - which takes the whole server down, not just the request. The
    /// book is a couple of hundred pages with names and places attached, so it was never
    /// going to fit in one.
    ///
    /// A header first, carrying the regions and their rewards, so the window has something to
    /// draw immediately. Then the pages in batches sized by a running estimate of the bytes
    /// each one costs rather than by a count, because a page's size is mostly the length of
    /// the names on it and those vary by a factor of three.
    ///
    /// The names and the maps are carried even though the client holds a monster database of
    /// its own, because the book's list is not the database's list: it is built from the maps
    /// that actually loaded, and it is the same list the travel request is checked against. A
    /// window offering a map the server will refuse is worse than a slightly larger packet.
    /// </remarks>
    public static void SendAdventureBook(Player player)
    {
        var header = NetworkManager.StartPacket(PacketType.AdventureBookData, 1024);
        header.Write((byte)AdventureBookDataType.Header);

        var rank = AdventureBookProgress.GetRank(player);
        header.Write((byte)rank);
        header.Write((short)AdventureBookProgress.CountStars(player));
        header.Write((short)AdventureBook.StarTotal);
        header.Write((short)AdventureBookRank.StarsForNextRank(rank));

        header.Write((byte)AdventureBook.Regions.Count);
        foreach (var region in AdventureBook.Regions)
        {
            header.Write(region.Name);
            header.Write(region.RewardHeadgear);
            header.Write((byte)(player.GetNpcFlag(region.CompletionFlag) != 0 ? 1 : 0));
        }

        NetworkManager.SendMessage(header, player.Connection);

        var batch = new List<(AdventureBookEntry Entry, int Region)>();
        var bytes = 0;

        for (var i = 0; i < AdventureBook.Regions.Count; i++)
        {
            foreach (var entry in AdventureBook.Regions[i].Entries)
            {
                var cost = EstimateEntryBytes(entry);
                if (bytes + cost > BatchByteBudget && batch.Count > 0)
                {
                    SendPageBatch(player, batch);
                    batch.Clear();
                    bytes = 0;
                }

                batch.Add((entry, i));
                bytes += cost;
            }
        }

        if (batch.Count > 0)
            SendPageBatch(player, batch);

        //Said last, so the window knows it has everything rather than guessing from a count
        //it would have to be told separately anyway.
        var done = NetworkManager.StartPacket(PacketType.AdventureBookData, 8);
        done.Write((byte)AdventureBookDataType.Complete);
        NetworkManager.SendMessage(done, player.Connection);
    }

    /// <summary>Roughly what one page costs on the wire, erring high.</summary>
    private static int EstimateEntryBytes(AdventureBookEntry entry)
    {
        var size = 32 + entry.Name.Length * 3;
        var shown = Math.Min(entry.Sightings.Length, MaxSightingsSent);
        for (var i = 0; i < shown; i++)
            size += 8 + entry.Sightings[i].Map.Length * 3;

        return size;
    }

    private static void SendPageBatch(Player player, List<(AdventureBookEntry Entry, int Region)> batch)
    {
        var packet = NetworkManager.StartPacket(PacketType.AdventureBookData, BatchByteBudget * 2);
        packet.Write((byte)AdventureBookDataType.Pages);
        packet.Write((short)batch.Count);

        foreach (var (entry, region) in batch)
        {
            packet.Write(entry.MonsterId);
            packet.Write((byte)region);
            packet.Write(entry.Name);
            packet.Write((short)entry.Level);
            packet.Write((short)entry.HuntTarget);
            packet.Write((short)entry.HuntTargetLarge);
            packet.Write(entry.CardItemId);
            packet.Write(AdventureBookProgress.GetKills(player, entry));
            packet.Write((byte)AdventureBookProgress.GetStars(player, entry));

            var shown = Math.Min(entry.Sightings.Length, MaxSightingsSent);
            packet.Write((byte)shown);
            for (var i = 0; i < shown; i++)
            {
                packet.Write(entry.Sightings[i].Map);
                packet.Write((short)entry.Sightings[i].Count);
            }
        }

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>One page that moved, so a star landing does not cost a whole book.</summary>
    public static void SendAdventureBookPage(Player player, AdventureBookEntry entry)
    {
        if (player.Connection == null)
            return;

        var packet = NetworkManager.StartPacket(PacketType.AdventureBookData, 32);
        packet.Write((byte)AdventureBookDataType.PageUpdate);
        packet.Write(entry.MonsterId);
        packet.Write(AdventureBookProgress.GetKills(player, entry));
        packet.Write((byte)AdventureBookProgress.GetStars(player, entry));
        packet.Write((byte)AdventureBookProgress.GetRank(player));
        packet.Write((short)AdventureBookProgress.CountStars(player));

        NetworkManager.SendMessage(packet, player.Connection);
    }
}
