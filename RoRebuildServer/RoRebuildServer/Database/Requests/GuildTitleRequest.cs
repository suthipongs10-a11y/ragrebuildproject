using Microsoft.EntityFrameworkCore;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// Writes a guild's title down.
///
/// A single column update rather than loading the guild and saving it back: the live
/// object is already the truth here, and this only has to make it survive a restart.
/// </summary>
public class GuildTitleRequest : IDbRequest
{
    private readonly int guildId;
    private readonly string title;

    public GuildTitleRequest(int guildId, string title)
    {
        this.guildId = guildId;
        this.title = title;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        await dbContext.Guilds.Where(g => g.Id == guildId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.GuildTitle, title));
    }
}
