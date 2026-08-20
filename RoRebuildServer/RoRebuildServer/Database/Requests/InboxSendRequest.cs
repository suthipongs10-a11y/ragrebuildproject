using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// Writes one parcel down, and tells the recipient if they are here to be told.
///
/// An insert rather than a read-modify-write, which is the whole reason parcels are rows:
/// two auctions ending in the same second both just add a row.
/// </summary>
public class InboxSendRequest : IDbRequest
{
    private readonly DbInboxParcel parcel;

    public InboxSendRequest(DbInboxParcel parcel) => this.parcel = parcel;

    public async Task ExecuteAsync(RoContext dbContext)
    {
        dbContext.InboxParcels.Add(parcel);
        await dbContext.SaveChangesAsync();

        var waiting = await dbContext.InboxParcels.CountAsync(p => p.CharacterId == parcel.CharacterId);
        var player = Inbox.FindOnline(parcel.CharacterId);
        if (player != null)
            CommandBuilder.SendInboxCount(player, waiting);
    }
}
