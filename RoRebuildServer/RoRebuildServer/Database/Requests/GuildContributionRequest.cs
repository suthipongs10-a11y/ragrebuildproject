using Microsoft.EntityFrameworkCore;

namespace RoRebuildServer.Database.Requests;

/// <summary>Writes down what a guild has been given and what it has left to spend.</summary>
public class GuildContributionRequest : IDbRequest
{
    private readonly int guildId;
    private readonly long contribution;
    private readonly int skillPoints;

    public GuildContributionRequest(int guildId, long contribution, int skillPoints)
    {
        this.guildId = guildId;
        this.contribution = contribution;
        this.skillPoints = skillPoints;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        await dbContext.Guilds.Where(g => g.Id == guildId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(g => g.Contribution, contribution)
                .SetProperty(g => g.SkillPoints, skillPoints));
    }
}
