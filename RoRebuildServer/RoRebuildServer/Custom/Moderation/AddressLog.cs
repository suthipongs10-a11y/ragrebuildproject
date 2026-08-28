using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom.Moderation;

/// <summary>
/// Which account has been seen at which address.
/// </summary>
/// <remarks>
/// This is what turns "that one looks like a bot" into something a GM can act on. One
/// suspicious character is a guess and banning on a guess is how real players get banned;
/// eleven characters that have only ever connected from a single address, all created the
/// same afternoon, is not a guess. The question cannot be asked at all unless somebody wrote
/// the addresses down as they came in, which is all this does.
///
/// Kept in memory in both directions because both are asked: the addresses one account has
/// used, and the accounts that have used one address. On a server this size that is a few
/// thousand short strings.
///
/// It records rather than judges. Sharing an address is family, a phone hotspot, a shared
/// house, an office. What comes out of here is a list for somebody to read, never a ban.
/// </remarks>
public static class AddressLog
{
    private static readonly ConcurrentDictionary<int, ConcurrentDictionary<string, byte>> addressesByAccount = new();

    /// <summary>address -> account id -> the name that account last logged in under</summary>
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<int, string>> accountsByAddress =
        new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// The address each account came in from most recently, which is the one worth banning.
    /// </summary>
    /// <remarks>
    /// Kept apart from the set above because a set has no order. Taking the last entry out
    /// of it gives whichever address sorts last alphabetically, which is a different address
    /// from the one they are using right now on all but the luckiest day.
    /// </remarks>
    private static readonly ConcurrentDictionary<int, string> lastAddress = new();

    public static void Load(RoContext db)
    {
        addressesByAccount.Clear();
        accountsByAddress.Clear();
        lastAddress.Clear();

        var rows = 0;
        //Ordered, so the last row read for an account really is the one seen most recently.
        //Unordered, "last" would mean "whichever the table handed over last", which is not a
        //fact about anybody.
        foreach (var row in db.AccountAddresses.AsNoTracking().OrderBy(a => a.LastSeen))
        {
            Remember(row.AccountId, row.AccountName, row.Address);
            rows++;
        }

        if (rows > 0)
            ServerLogger.Log($"[Ban] {rows} account/address pair(s) known.");
    }

    /// <summary>Notes the pair, in memory now and in the database when the queue gets to it.</summary>
    public static void Record(int accountId, string accountName, string? address)
    {
        if (accountId <= 0 || string.IsNullOrWhiteSpace(address))
            return;

        Remember(accountId, accountName, address);
        RoDatabase.EnqueueDbRequest(new AccountAddressRequest(accountId, accountName, address, DateTime.UtcNow));
    }

    private static void Remember(int accountId, string accountName, string address)
    {
        var addresses = addressesByAccount.GetOrAdd(accountId,
            _ => new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase));
        addresses[address] = 0;

        var accounts = accountsByAddress.GetOrAdd(address, _ => new ConcurrentDictionary<int, string>());
        accounts[accountId] = accountName;

        lastAddress[accountId] = address;
    }

    /// <summary>Every address this account has ever connected from.</summary>
    public static List<string> AddressesOf(int accountId) =>
        addressesByAccount.TryGetValue(accountId, out var set) ? set.Keys.OrderBy(a => a).ToList() : new List<string>();

    /// <summary>The address this account was last seen at, which is the one worth banning.</summary>
    public static string? LastAddressOf(int accountId) =>
        lastAddress.TryGetValue(accountId, out var address) ? address : null;

    /// <summary>Every account ever seen at this address, as (id, name).</summary>
    public static List<(int Id, string Name)> AccountsAt(string address) =>
        accountsByAddress.TryGetValue(address, out var set)
            ? set.Select(kv => (kv.Key, kv.Value)).OrderBy(a => a.Value).ToList()
            : new List<(int, string)>();

    /// <summary>
    /// An account by the name it logs in under, out of everything ever seen.
    /// </summary>
    /// <remarks>
    /// The one way to name an account that is not currently connected without going to the
    /// database, which the chat commands cannot do: they run on the world thread and would
    /// have to await an answer that arrives after the command has finished.
    /// </remarks>
    public static bool TryFindAccount(string accountName, out int accountId, out string name)
    {
        foreach (var atAddress in accountsByAddress.Values)
        {
            foreach (var (id, known) in atAddress)
            {
                if (!string.Equals(known, accountName, StringComparison.OrdinalIgnoreCase))
                    continue;

                accountId = id;
                name = known;
                return true;
            }
        }

        accountId = 0;
        name = "";
        return false;
    }

    /// <summary>
    /// Every account that has shared an address with this one, this one included.
    /// </summary>
    public static List<(int Id, string Name, string Address)> RelatedTo(int accountId)
    {
        var found = new List<(int, string, string)>();
        var seen = new HashSet<int>();

        foreach (var address in AddressesOf(accountId))
        {
            foreach (var (id, name) in AccountsAt(address))
            {
                if (!seen.Add(id))
                    continue;
                found.Add((id, name, address));
            }
        }

        return found;
    }
}
