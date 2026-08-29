using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.Simulation.Enchanting;

namespace RoRebuildServer.Database.Requests;

/// <summary>
/// Writes down the options on one item, replacing whatever was there before.
/// </summary>
/// <remarks>
/// An upsert rather than the plain insert the forged-item record does, because these
/// change: a scroll used on an already-enchanted item overwrites the block, and doing
/// that with an Add would throw on the duplicate key.
///
/// Enqueued rather than awaited. The registry in memory already has the new options and
/// the player is already looking at them, so nothing on screen is waiting for this - all
/// it has to do is survive a restart.
/// </remarks>
public class EnchantItemRecordRequest : IDbRequest
{
    private readonly Guid uniqueId;
    private readonly byte tier;
    private readonly string stat1;
    private readonly int value1;
    private readonly string stat2;
    private readonly int value2;
    private readonly string stat3;
    private readonly int value3;
    private readonly DateTime enchantedAt;

    public EnchantItemRecordRequest(Guid uniqueId, ItemEnchant enchant, DateTime enchantedAt)
    {
        this.uniqueId = uniqueId;
        this.enchantedAt = enchantedAt;

        tier = (byte)enchant.Tier;

        //Copied out field by field rather than holding the ItemEnchant itself. The registry
        //keeps that object and a later re-roll writes into it, so a request still sitting in
        //the queue would otherwise save the newer options under the older timestamp.
        stat1 = NameOf(enchant, 0);
        value1 = ValueOf(enchant, 0);
        stat2 = NameOf(enchant, 1);
        value2 = ValueOf(enchant, 1);
        stat3 = NameOf(enchant, 2);
        value3 = ValueOf(enchant, 2);
    }

    private static string NameOf(ItemEnchant enchant, int i) =>
        i < enchant.Count ? enchant.Options[i].Stat.ToString() : "";

    private static int ValueOf(ItemEnchant enchant, int i) =>
        i < enchant.Count ? enchant.Options[i].Value : 0;

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var row = await dbContext.EnchantedItems.FirstOrDefaultAsync(e => e.UniqueId == uniqueId);

        if (row == null)
        {
            row = new DbEnchantedItem() { UniqueId = uniqueId };
            dbContext.EnchantedItems.Add(row);
        }

        row.Tier = tier;
        row.Stat1 = stat1;
        row.Value1 = value1;
        row.Stat2 = stat2;
        row.Value2 = value2;
        row.Stat3 = stat3;
        row.Value3 = value3;
        row.EnchantedAt = enchantedAt;

        await dbContext.SaveChangesAsync();
    }
}

/// <summary>
/// Takes the options off an item, which is what the blank scroll does.
/// </summary>
/// <remarks>
/// The row is deleted rather than blanked. An item with no options and an item that was
/// never enchanted are the same thing to everything that reads this, and keeping empty
/// rows around would mean the registry holds an entry for every item anybody has ever
/// reset.
/// </remarks>
public class EnchantItemClearRequest : IDbRequest
{
    private readonly Guid uniqueId;

    public EnchantItemClearRequest(Guid uniqueId) => this.uniqueId = uniqueId;

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var row = await dbContext.EnchantedItems.FirstOrDefaultAsync(e => e.UniqueId == uniqueId);
        if (row == null)
            return;

        dbContext.EnchantedItems.Remove(row);
        await dbContext.SaveChangesAsync();
    }
}
