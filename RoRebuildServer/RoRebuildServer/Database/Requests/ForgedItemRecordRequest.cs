using RoRebuildServer.Database.Domain;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// Writes down who forged a weapon.
///
/// Enqueued rather than awaited: the smith is already holding the weapon and the registry
/// in memory already knows the name, so nothing on screen is waiting for this. All it has
/// to do is survive a restart.
/// </summary>
public class ForgedItemRecordRequest : IDbRequest
{
    private readonly Guid uniqueId;
    private readonly Guid forgerId;
    private readonly string forgerName;
    private readonly DateTime forgedAt;

    public ForgedItemRecordRequest(Guid uniqueId, Guid forgerId, string forgerName, DateTime forgedAt)
    {
        this.uniqueId = uniqueId;
        this.forgerId = forgerId;
        this.forgerName = forgerName;
        this.forgedAt = forgedAt;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        dbContext.ForgedItems.Add(new DbForgedItem()
        {
            UniqueId = uniqueId,
            ForgerId = forgerId,
            ForgerName = forgerName,
            ForgedAt = forgedAt
        });

        await dbContext.SaveChangesAsync();
    }
}
