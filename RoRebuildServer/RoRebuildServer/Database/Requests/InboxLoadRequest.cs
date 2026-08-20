using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Logging;
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
    private readonly string ownerName;

    public InboxLoadRequest(Guid characterId, string ownerName)
    {
        this.characterId = characterId;
        this.ownerName = ownerName;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var parcels = await dbContext.InboxParcels.AsNoTracking()
            .Where(p => p.CharacterId == characterId)
            .OrderBy(p => p.Id)
            .ToListAsync();

        //Looked up after the query rather than before: the read is the slow part, and a
        //player who logged out while it ran has nowhere to send it anyway.
        var player = Inbox.FindOnline(characterId, ownerName);
        if (player == null)
        {
            //Said out loud rather than returned quietly. The window is sitting there
            //waiting for this answer, and a request that decides not to send one leaves
            //it waiting forever with nothing anywhere to say why.
            ServerLogger.LogWarning($"Inbox for {ownerName} ({characterId}) was read but they "
                                    + "could not be found online to send it to.");
            return;
        }

        CommandBuilder.SendInboxContents(player, parcels);
    }
}
