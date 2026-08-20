using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// Reads back what is waiting for one character and sends it to them.
///
/// Asked for when the window opens rather than kept in memory: a parcel box is looked at
/// rarely, and holding one per logged in character means holding a copy that has to be
/// kept in step with a table several other things write to.
/// </summary>
public class InboxLoadRequest : IDbRequest
{
    private readonly Guid characterId;

    public InboxLoadRequest(Guid characterId) => this.characterId = characterId;

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var parcels = await dbContext.InboxParcels.AsNoTracking()
            .Where(p => p.CharacterId == characterId)
            .OrderBy(p => p.Id)
            .ToListAsync();

        //Looked up after the query rather than before: the read is the slow part, and a
        //player who logged out while it ran has nowhere to send it anyway.
        var player = Inbox.FindOnline(characterId);
        if (player != null)
            CommandBuilder.SendInboxContents(player, parcels);
    }
}
