using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom.Moderation;

/// <summary>
/// Who is not allowed in, in memory, so the question costs nothing to ask.
/// </summary>
/// <remarks>
/// Read whole at startup and kept, the same trade the forged item registry makes and for a
/// sharper reason: this is asked on the connection path, before anything else happens, of
/// every connection including the ones that are about to be refused. A database round trip
/// there is a database round trip a flood of bots can ask for as fast as they can open
/// sockets, which is exactly the situation the list exists for.
///
/// Writes go to memory first and the database second, through the ordinary queue. A ban has
/// to bite on the next connection attempt, not on the next time the disk is free.
///
/// Both dictionaries are concurrent because the two sides touch this from different threads:
/// a GM types a command on the world thread, and a connection is checked on whichever thread
/// the web server handed it to.
/// </remarks>
public static class BanList
{
    private static readonly ConcurrentDictionary<int, DbBan> byAccount = new();
    private static readonly ConcurrentDictionary<string, DbBan> byAddress =
        new(StringComparer.OrdinalIgnoreCase);

    /// <summary>What a ban with no end is stored as.</summary>
    public static readonly DateTime Forever = DateTime.MaxValue;

    /// <summary>Reads the table into memory. Called once, while the server is coming up.</summary>
    public static void Load(RoContext db)
    {
        byAccount.Clear();
        byAddress.Clear();

        var now = DateTime.UtcNow;
        var live = 0;

        foreach (var row in db.Bans.AsNoTracking())
        {
            if (row.ExpiresAt <= now)
                continue; //served its time while the server was down

            if (row.AccountId > 0 && row.Address.Length == 0)
                byAccount[row.AccountId] = row;
            else if (row.Address.Length > 0)
                byAddress[row.Address] = row;
            live++;
        }

        if (live > 0)
            ServerLogger.Log($"[Ban] {live} ban(s) still in force.");
    }

    /// <summary>The ban on this account, if there is one that has not run out.</summary>
    public static bool TryGetForAccount(int accountId, out DbBan ban) =>
        TryGet(byAccount, accountId, out ban);

    /// <summary>The ban on this address, if there is one that has not run out.</summary>
    public static bool TryGetForAddress(string? address, out DbBan ban)
    {
        ban = null!;
        return !string.IsNullOrEmpty(address) && TryGet(byAddress, address, out ban);
    }

    /// <summary>
    /// The shared read. A ban that has run out is dropped as it is found rather than swept
    /// on a timer: this runs on every connection, so it is already the busiest place to
    /// notice, and a sweep would be a second thing to get wrong.
    /// </summary>
    private static bool TryGet<TKey>(ConcurrentDictionary<TKey, DbBan> from, TKey key, out DbBan ban)
        where TKey : notnull
    {
        ban = null!;

        if (!from.TryGetValue(key, out var found))
            return false;

        if (found.ExpiresAt > DateTime.UtcNow)
        {
            ban = found;
            return true;
        }

        from.TryRemove(key, out _);
        RoDatabase.EnqueueDbRequest(new BanLiftRequest(found.AccountId, found.Address));
        return false;
    }

    public static DbBan BanAccount(int accountId, string accountName, DateTime expiresAt, string reason, string by)
    {
        var ban = new DbBan
        {
            AccountId = accountId,
            Address = "",
            AccountName = accountName,
            Reason = reason,
            BannedBy = by,
            BannedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt
        };

        byAccount[accountId] = ban;
        RoDatabase.EnqueueDbRequest(new BanWriteRequest(ban));
        ServerLogger.Log($"[Ban] {by} banned account {accountName} ({accountId}) until {expiresAt:u}: {reason}");
        return ban;
    }

    public static DbBan BanAddress(string address, string accountName, DateTime expiresAt, string reason, string by)
    {
        var ban = new DbBan
        {
            AccountId = 0,
            Address = address,
            AccountName = accountName,
            Reason = reason,
            BannedBy = by,
            BannedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt
        };

        byAddress[address] = ban;
        RoDatabase.EnqueueDbRequest(new BanWriteRequest(ban));
        ServerLogger.Log($"[Ban] {by} banned address {address} until {expiresAt:u}: {reason}");
        return ban;
    }

    public static bool LiftAccount(int accountId)
    {
        var had = byAccount.TryRemove(accountId, out _);
        RoDatabase.EnqueueDbRequest(new BanLiftRequest(accountId, ""));
        return had;
    }

    public static bool LiftAddress(string address)
    {
        var had = byAddress.TryRemove(address, out _);
        RoDatabase.EnqueueDbRequest(new BanLiftRequest(0, address));
        return had;
    }

    /// <summary>Every ban still in force, accounts first, for the list a GM asks for.</summary>
    public static List<DbBan> Active()
    {
        var now = DateTime.UtcNow;
        var all = new List<DbBan>();
        all.AddRange(byAccount.Values.Where(b => b.ExpiresAt > now));
        all.AddRange(byAddress.Values.Where(b => b.ExpiresAt > now));
        return all.OrderBy(b => b.ExpiresAt).ToList();
    }

    /// <summary>How long is left, in words, for a line somebody is going to read.</summary>
    public static string Remaining(DbBan ban)
    {
        if (ban.ExpiresAt >= Forever)
            return "ถาวร";

        var left = ban.ExpiresAt - DateTime.UtcNow;
        if (left.TotalMinutes < 1)
            return "อีกไม่ถึงนาที";
        if (left.TotalHours < 1)
            return $"อีก {(int)left.TotalMinutes} นาที";
        if (left.TotalDays < 1)
            return $"อีก {(int)left.TotalHours} ชั่วโมง";
        return $"อีก {(int)left.TotalDays} วัน";
    }
}
