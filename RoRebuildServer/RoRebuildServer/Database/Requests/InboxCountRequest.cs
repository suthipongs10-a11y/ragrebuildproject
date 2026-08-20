using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// How much is waiting, without reading any of it.
///
/// Asked once on login, because everything else that sets the number does so when a parcel
/// arrives - so somebody who was sent five things while logged out would come back to a
/// badge reading nothing, and never think to open the box.
/// </summary>
public class InboxCountRequest : IDbRequest
{
    private readonly Guid characterId;

    public InboxCountRequest(Guid characterId) => this.characterId = characterId;

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var waiting = await dbContext.InboxParcels.CountAsync(p => p.CharacterId == characterId);
        if (waiting <= 0)
            return; //nothing to say, and the client starts at zero anyway

        var player = Inbox.FindOnline(characterId);
        if (player != null)
            CommandBuilder.SendInboxCount(player, waiting);
    }
}
