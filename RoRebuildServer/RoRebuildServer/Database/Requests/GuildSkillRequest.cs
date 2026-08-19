using Microsoft.EntityFrameworkCore;

namespace RoRebuildServer.Database.Requests;

/// <summary>Writes down what a guild has learned and what it has left to spend.</summary>
public class GuildSkillRequest : IDbRequest
{
    private readonly int guildId;
    private readonly int skillPoints;
    private readonly string skills;

    public GuildSkillRequest(int guildId, int skillPoints, string skills)
    {
        this.guildId = guildId;
        this.skillPoints = skillPoints;
        this.skills = skills;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        await dbContext.Guilds.Where(g => g.Id == guildId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(g => g.SkillPoints, skillPoints)
                .SetProperty(g => g.Skills, skills));
    }
}
