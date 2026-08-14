using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Logging;
using RoRebuildServer.Simulation.Guilds;

namespace RoRebuildServer.Database.Requests;

public enum GuildMembershipAction
{
    Join,
    Leave,
    Disband
}

/// <summary>
/// Persists a change of guild membership. The in-memory guild is already updated by
/// the caller so the player sees the result immediately, this only writes the column
/// behind it and, for a disband, deletes the guild row.
/// </summary>
public class GuildMembershipRequest : IDbRequest
{
    public GuildMembershipAction Action;
    public Guid CharacterId;
    public int GuildId;

    public GuildMembershipRequest(GuildMembershipAction action, Guid characterId, int guildId)
    {
        Action = action;
        CharacterId = characterId;
        GuildId = guildId;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        try
        {
            switch (Action)
            {
                case GuildMembershipAction.Join:
                    await dbContext.Character.Where(c => c.Id == CharacterId)
                        .ExecuteUpdateAsync(s => s.SetProperty(c => c.GuildId, GuildId));
                    break;

                case GuildMembershipAction.Leave:
                    await dbContext.Character.Where(c => c.Id == CharacterId)
                        .ExecuteUpdateAsync(s => s.SetProperty(c => c.GuildId, (int?)null));
                    break;

                case GuildMembershipAction.Disband:
                    //clear every member first so no character is left pointing at a dead guild
                    await dbContext.Character.Where(c => c.GuildId == GuildId)
                        .ExecuteUpdateAsync(s => s.SetProperty(c => c.GuildId, (int?)null));
                    await dbContext.Guilds.Where(g => g.Id == GuildId).ExecuteDeleteAsync();
                    GuildManager.Remove(GuildId);
                    break;
            }
        }
        catch (Exception e)
        {
            ServerLogger.LogWarning($"Guild membership update ({Action}) failed due to exception. Exception: " + e.Message);
        }
    }
}
