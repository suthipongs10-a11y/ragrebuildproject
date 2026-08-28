using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database.Domain;

namespace RoRebuildServer.Database.Requests;

/// <summary>Writes a ban down. The list in memory already has it; this is so it survives.</summary>
public class BanWriteRequest : IDbRequest
{
    private readonly DbBan ban;

    public BanWriteRequest(DbBan ban) => this.ban = ban;

    public async Task ExecuteAsync(RoContext dbContext)
    {
        //A second ban on the same target replaces the first rather than stacking, so the
        //table says the same thing the list in memory does: one ban, the newest terms.
        if (ban.AccountId > 0)
            await dbContext.Bans.Where(b => b.AccountId == ban.AccountId && b.Address == "").ExecuteDeleteAsync();
        else
            await dbContext.Bans.Where(b => b.Address == ban.Address).ExecuteDeleteAsync();

        //A fresh row rather than the object itself. The ban list is holding that instance for
        //the life of the ban, and handing a long lived object to a context that is about to
        //be disposed - twice, if the same target is banned again - is a way to end up with
        //an entity carrying an id from a row that no longer exists.
        dbContext.Bans.Add(new DbBan
        {
            AccountId = ban.AccountId,
            Address = ban.Address,
            AccountName = ban.AccountName,
            Reason = ban.Reason,
            BannedBy = ban.BannedBy,
            BannedAt = ban.BannedAt,
            ExpiresAt = ban.ExpiresAt
        });

        await dbContext.SaveChangesAsync();
    }
}

/// <summary>Takes a ban off, by account or by address.</summary>
public class BanLiftRequest : IDbRequest
{
    private readonly int accountId;
    private readonly string address;

    public BanLiftRequest(int accountId, string address)
    {
        this.accountId = accountId;
        this.address = address ?? "";
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        if (accountId > 0)
            await dbContext.Bans.Where(b => b.AccountId == accountId && b.Address == "").ExecuteDeleteAsync();
        else if (address.Length > 0)
            await dbContext.Bans.Where(b => b.Address == address).ExecuteDeleteAsync();
    }
}

/// <summary>
/// Marks down that this account was seen at this address.
/// </summary>
/// <remarks>
/// An update when the pair is already known and an insert when it is not, so the table holds
/// one row per pair however many times somebody logs in. The count is worth having on its
/// own: one login from an address is a friend visiting, four hundred is where they live.
/// </remarks>
public class AccountAddressRequest : IDbRequest
{
    private readonly int accountId;
    private readonly string accountName;
    private readonly string address;
    private readonly DateTime seenAt;

    public AccountAddressRequest(int accountId, string accountName, string address, DateTime seenAt)
    {
        this.accountId = accountId;
        this.accountName = accountName;
        this.address = address;
        this.seenAt = seenAt;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var existing = await dbContext.AccountAddresses
            .FirstOrDefaultAsync(a => a.AccountId == accountId && a.Address == address);

        if (existing != null)
        {
            existing.LastSeen = seenAt;
            existing.LoginCount += 1;
            existing.AccountName = accountName;
        }
        else
        {
            dbContext.AccountAddresses.Add(new DbAccountAddress
            {
                AccountId = accountId,
                AccountName = accountName,
                Address = address,
                FirstSeen = seenAt,
                LastSeen = seenAt,
                LoginCount = 1
            });
        }

        await dbContext.SaveChangesAsync();
    }
}
