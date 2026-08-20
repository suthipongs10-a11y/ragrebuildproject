using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// Hands one parcel over, or as many as will fit.
///
/// The order matters and is the whole of the design. The row is deleted first, then the
/// contents are handed over on the game thread, and if that fails the parcel is written
/// back. Doing it the other way round - hand over, then delete - means a crash or a
/// disconnect between the two leaves the parcel still sitting there with its contents
/// already in somebody's bag, which is how one sword becomes two.
///
/// Writing it back is a new row with a new number. That is visible to the player as a
/// parcel moving to the bottom of the list, which is a fair price for never losing one.
/// </summary>
public class InboxClaimRequest : IDbRequest
{
    private readonly Guid characterId;
    private readonly int parcelId;
    private readonly bool claimEverything;

    /// <summary>Pass -1 as the parcel to take everything that will fit.</summary>
    public InboxClaimRequest(Guid characterId, int parcelId)
    {
        this.characterId = characterId;
        this.parcelId = parcelId;
        claimEverything = parcelId < 0;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var query = dbContext.InboxParcels.Where(p => p.CharacterId == characterId);
        if (!claimEverything)
            query = query.Where(p => p.Id == parcelId);

        var parcels = await query.OrderBy(p => p.Id).ToListAsync();
        if (parcels.Count == 0)
        {
            await Report(dbContext);
            return;
        }

        //Gone from the table before anything is given out. Everything after this point is
        //responsible for either delivering it or writing it back.
        dbContext.InboxParcels.RemoveRange(parcels);
        await dbContext.SaveChangesAsync();

        var payload = new List<(int zeny, ItemReference? item, DbInboxParcel row)>();
        foreach (var parcel in parcels)
        {
            ItemReference? item = null;
            if (parcel.ItemId > 0 && parcel.ItemCount > 0)
                item = parcel.ReadItem();
            payload.Add((parcel.Zeny, item, parcel));
        }

        var owner = characterId;
        World.Instance.MainThreadActions.Push(() =>
        {
            var player = Inbox.FindOnline(owner);
            var returned = new List<DbInboxParcel>();
            var taken = 0;

            foreach (var (zeny, item, row) in payload)
            {
                if (player != null && Inbox.TryDeliver(player, zeny, item))
                {
                    taken++;
                    continue;
                }

                //A full bag, or a player who left between the read and here. Either way
                //this is the last place the parcel exists, so it goes back.
                returned.Add(new DbInboxParcel
                {
                    CharacterId = row.CharacterId,
                    Reason = row.Reason,
                    FromName = row.FromName,
                    Zeny = row.Zeny,
                    ItemId = row.ItemId,
                    ItemCount = row.ItemCount,
                    IsUnique = row.IsUnique,
                    Refine = row.Refine,
                    ItemFlags = row.ItemFlags,
                    UniqueId = row.UniqueId,
                    Slot0 = row.Slot0,
                    Slot1 = row.Slot1,
                    Slot2 = row.Slot2,
                    Slot3 = row.Slot3,
                    SentAt = row.SentAt,
                });
            }

            if (player != null && returned.Count > 0)
                CommandBuilder.ErrorMessage(player.Connection,
                    taken > 0 ? "กระเป๋าเต็ม รับได้บางส่วน" : "กระเป๋าเต็ม รับของไม่ได้");

            RoDatabase.EnqueueDbRequest(new InboxReturnRequest(owner, returned));
        });
    }

    /// <summary>Nothing was there to take, so only the count is worth sending back.</summary>
    private async Task Report(RoContext dbContext)
    {
        var waiting = await dbContext.InboxParcels.CountAsync(p => p.CharacterId == characterId);
        var player = Inbox.FindOnline(characterId);
        if (player != null)
            CommandBuilder.SendInboxCount(player, waiting);
    }
}

/// <summary>
/// Puts back whatever could not be handed over, and sends the box's new contents.
///
/// Its own request because the putting back happens on the game thread, which cannot
/// touch the database - so it comes back round the queue. The list is usually empty, and
/// this then does nothing but refresh the window.
/// </summary>
public class InboxReturnRequest : IDbRequest
{
    private readonly Guid characterId;
    private readonly List<DbInboxParcel> parcels;

    public InboxReturnRequest(Guid characterId, List<DbInboxParcel> parcels)
    {
        this.characterId = characterId;
        this.parcels = parcels;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        if (parcels.Count > 0)
        {
            dbContext.InboxParcels.AddRange(parcels);
            await dbContext.SaveChangesAsync();
        }

        var remaining = await dbContext.InboxParcels.AsNoTracking()
            .Where(p => p.CharacterId == characterId)
            .OrderBy(p => p.Id)
            .ToListAsync();

        var player = Inbox.FindOnline(characterId);
        if (player != null)
            CommandBuilder.SendInboxContents(player, remaining);
    }
}
