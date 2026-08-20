using Microsoft.EntityFrameworkCore;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// Writes a character's guild title down.
///
/// A single column update rather than loading the character and saving it back: the live
/// object is already the truth here, and this only has to make it survive a restart.
/// Keyed on the character's id rather than their name, because a name is what a player
/// types and an id is what the row is.
/// </summary>
public class CharacterTitleRequest : IDbRequest
{
    private readonly Guid characterId;
    private readonly string title;

    public CharacterTitleRequest(Guid characterId, string title)
    {
        this.characterId = characterId;
        this.title = title;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        await dbContext.Character.Where(c => c.Id == characterId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.GuildTitle, title));
    }
}
