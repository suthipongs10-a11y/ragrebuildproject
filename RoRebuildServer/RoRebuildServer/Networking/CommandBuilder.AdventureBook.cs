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
    private const int MaxSightingsSent = 5;

    /// <summary>
    /// The whole book and one character's place in it.
    /// </summary>
    /// <remarks>
    /// Sent whole rather than a page at a time, on the reasoning that somebody who opened the
    /// book is going to read more than one page of it.
    ///
    /// The names and the maps are carried even though the client holds a monster database of
    /// its own, because the book's list is not the database's list: it is built from the maps
    /// that actually loaded, and it is the same list the travel request is checked against. A
    /// window offering a map the server will refuse is worse than a slightly larger packet.
    ///
    /// Only the five most crowded maps for each monster are sent. The window shows them as
    /// somewhere to go, and past five it is a list nobody reads attached to a packet
    /// everybody pays for.
    /// </remarks>
    public static void SendAdventureBook(Player player)
    {
        var packet = NetworkManager.StartPacket(PacketType.AdventureBookData, 8192);
        packet.Write((byte)AdventureBookDataType.Book);

        var rank = AdventureBookProgress.GetRank(player);
        packet.Write((byte)rank);
        packet.Write((short)AdventureBookProgress.CountStars(player));
        packet.Write((short)AdventureBook.StarTotal);
        packet.Write((short)AdventureBookRank.StarsForNextRank(rank));

        packet.Write((byte)AdventureBook.Regions.Count);
        foreach (var region in AdventureBook.Regions)
        {
            packet.Write(region.Name);
            packet.Write(region.RewardHeadgear);
            packet.Write((byte)(player.GetNpcFlag(region.CompletionFlag) != 0 ? 1 : 0));
        }

        packet.Write((short)AdventureBook.EntriesByMonsterId.Count);
        for (var i = 0; i < AdventureBook.Regions.Count; i++)
        {
            var region = AdventureBook.Regions[i];
            foreach (var entry in region.Entries)
            {
                packet.Write(entry.MonsterId);
                packet.Write((byte)i);
                packet.Write(entry.Name);
                packet.Write((short)entry.Level);
                packet.Write((short)entry.HuntTarget);
                packet.Write((short)entry.HuntTargetLarge);
                packet.Write(entry.CardItemId);
                packet.Write(AdventureBookProgress.GetKills(player, entry));
                packet.Write((byte)AdventureBookProgress.GetStars(player, entry));

                var shown = Math.Min(entry.Sightings.Length, MaxSightingsSent);
                packet.Write((byte)shown);
                for (var s = 0; s < shown; s++)
                {
                    packet.Write(entry.Sightings[s].Map);
                    packet.Write((short)entry.Sightings[s].Count);
                }
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
