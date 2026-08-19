using Microsoft.EntityFrameworkCore;

namespace RoRebuildServer.Database.Requests;

/// <summary>Writes a guild's chosen emblem down, so it survives a restart.</summary>
public class GuildEmblemRequest : IDbRequest
{
    private readonly int guildId;
    private readonly int emblem;

    public GuildEmblemRequest(int guildId, int emblem)
    {
        this.guildId = guildId;
        this.emblem = emblem;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        await dbContext.Guilds.Where(g => g.Id == guildId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.Emblem, emblem));
    }
}
