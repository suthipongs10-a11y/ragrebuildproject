using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
//OutboundMessage lives under RebuildZoneServer despite sitting in this folder
using RebuildZoneServer.Networking;
using RoRebuildServer.Custom.BossLog;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;

namespace RoRebuildServer.Networking;

/// <summary>
/// What the boss hunter's log sends down the wire.
/// </summary>
/// <remarks>
/// Carried on the adventure book's packet rather than one of its own. The two are read in the
/// same window and arrive together, and a packet type is a slot in a table the client keeps by
/// hand - one worth spending on a new feature, not on a second view of one.
/// </remarks>
public static partial class CommandBuilder
{
    /// <summary>How many places to name for one boss.</summary>
    private const int MaxBossSightingsSent = 3;

    /// <summary>The box the slotted hat comes out of, which the log's page points at.</summary>
    private const string MvpBoxCode = "Pierre's_Treasurebox";

    public static void SendBossLog(Player player)
    {
        if (!BossLogManager.IsEnabled || !BossLog.IsBuilt)
            return;

        var header = NetworkManager.StartPacket(PacketType.AdventureBookData, 256);
        header.Write((byte)AdventureBookDataType.BossHeader);

        header.Write((short)BossLog.Total);
        header.Write((short)BossLog.MvpCount);
        header.Write((short)BossLogProgress.CountFound(player));
        header.Write((byte)(BossLogProgress.HasCleared(player) ? 1 : 0));
        header.Write((short)BossLogProgress.MvpKills(player));

        //The three items the page shows, by id, so the window finds the names and icons.
        header.Write(DataManager.ItemIdByName.TryGetValue(BossLogProgress.PlainHatCode, out var plain) ? plain : 0);
        header.Write(DataManager.ItemIdByName.TryGetValue(BossLogProgress.CrownedHatCode, out var crown) ? crown : 0);
        header.Write(DataManager.ItemIdByName.TryGetValue(MvpBoxCode, out var box) ? box : 0);

        //What is in the box and how often, so the window can say so rather than making
        //somebody open a hundred to find out. The weights are sent raw and the share worked
        //out at the other end - the table is a list of weights, not percentages, and turning
        //it into one here would mean two places that both have to be right.
        WriteBoxContents(header);

        NetworkManager.SendMessage(header, player.Connection);

        var batch = new List<BossLogEntry>();
        var bytes = 0;

        foreach (var entry in BossLog.Entries)
        {
            var cost = 20 + entry.Name.Length * 3;
            var shown = Math.Min(entry.Sightings.Length, MaxBossSightingsSent);
            for (var i = 0; i < shown; i++)
                cost += 6 + entry.Sightings[i].Map.Length * 3;

            if (bytes + cost > BatchByteBudget && batch.Count > 0)
            {
                SendBossBatch(player, batch);
                batch.Clear();
                bytes = 0;
            }

            batch.Add(entry);
            bytes += cost;
        }

        if (batch.Count > 0)
            SendBossBatch(player, batch);
    }

    /// <summary>
    /// The box's table, straight off the data it is rolled from.
    /// </summary>
    /// <remarks>
    /// Read from DataManager rather than written out again, so what the window promises and
    /// what the box gives are the same list. It is one lookup and the answer is a few hundred
    /// bytes, which is cheaper than the two lists disagreeing once.
    ///
    /// The loader expands a weight into that many copies of the item id, which is exactly
    /// what makes it easy to count back: how many times an id appears is its weight.
    /// </remarks>
    private static void WriteBoxContents(OutboundMessage packet)
    {
        if (!DataManager.ItemBoxSummonList.TryGetValue(MvpBoxCode, out var pool) || pool.Count == 0)
        {
            packet.Write((byte)0);
            return;
        }

        var weights = new Dictionary<int, int>();
        foreach (var id in pool)
            weights[id] = weights.GetValueOrDefault(id) + 1;

        var ordered = weights.OrderByDescending(kv => kv.Value).ThenBy(kv => kv.Key).ToList();

        packet.Write((byte)Math.Min(ordered.Count, 60));
        packet.Write((short)pool.Count);

        for (var i = 0; i < ordered.Count && i < 60; i++)
        {
            packet.Write(ordered[i].Key);
            packet.Write((short)ordered[i].Value);
        }
    }

    private static void SendBossBatch(Player player, List<BossLogEntry> batch)
    {
        var packet = NetworkManager.StartPacket(PacketType.AdventureBookData, BatchByteBudget * 2);
        packet.Write((byte)AdventureBookDataType.BossPages);
        packet.Write((short)batch.Count);

        foreach (var entry in batch)
        {
            packet.Write(entry.MonsterId);
            packet.Write(entry.Name);
            packet.Write((short)entry.Level);
            packet.Write((byte)(entry.IsMvp ? 1 : 0));
            packet.Write(BossLogProgress.GetKills(player, entry));

            var shown = Math.Min(entry.Sightings.Length, MaxBossSightingsSent);
            packet.Write((byte)shown);
            for (var i = 0; i < shown; i++)
                packet.Write(entry.Sightings[i].Map);
        }

        NetworkManager.SendMessage(packet, player.Connection);
    }

    /// <summary>One boss, after a kill, rather than the whole log again.</summary>
    public static void SendBossLogEntry(Player player, BossLogEntry entry)
    {
        if (player.Connection == null)
            return;

        var packet = NetworkManager.StartPacket(PacketType.AdventureBookData, 32);
        packet.Write((byte)AdventureBookDataType.BossUpdate);
        packet.Write(entry.MonsterId);
        packet.Write(BossLogProgress.GetKills(player, entry));
        packet.Write((short)BossLogProgress.CountFound(player));
        packet.Write((byte)(BossLogProgress.HasCleared(player) ? 1 : 0));
        packet.Write((short)BossLogProgress.MvpKills(player));

        NetworkManager.SendMessage(packet, player.Connection);
    }
}
