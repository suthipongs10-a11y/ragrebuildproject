using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RoRebuildServer.EntityComponents.Items;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// The columns it takes to write one item down, shared by every market table.
///
/// Plain columns rather than a blob. A blob would be four lines shorter and completely
/// opaque: an auction that will not pay out is a thing somebody has to look at in the
/// database, and "why does this row not work" is not a question a byte array answers.
/// The refine and the cards are the reason an item is worth bidding on, so they cannot
/// be dropped on the way through.
/// </summary>
public interface IDbMarketItem
{
    int ItemId { get; set; }
    int ItemCount { get; set; }
    bool IsUnique { get; set; }
    byte Refine { get; set; }
    byte ItemFlags { get; set; }
    Guid UniqueId { get; set; }
    int Slot0 { get; set; }
    int Slot1 { get; set; }
    int Slot2 { get; set; }
    int Slot3 { get; set; }
}

/// <summary>Turns one item into those columns and back, in one place for every table.</summary>
public static class DbMarketItemExtensions
{
    public static void StoreItem(this IDbMarketItem row, ItemReference item)
    {
        row.ItemId = item.Type == ItemType.UniqueItem ? item.UniqueItem.Id : item.Item.Id;
        row.ItemCount = item.Count;
        row.IsUnique = item.Type == ItemType.UniqueItem;

        if (!row.IsUnique)
            return;

        row.Refine = item.UniqueItem.Refine;
        row.ItemFlags = item.UniqueItem.Flags;
        row.UniqueId = item.UniqueItem.UniqueId;
        row.Slot0 = item.UniqueItem.SlotData(0);
        row.Slot1 = item.UniqueItem.SlotData(1);
        row.Slot2 = item.UniqueItem.SlotData(2);
        row.Slot3 = item.UniqueItem.SlotData(3);
    }

    public static ItemReference ReadItem(this IDbMarketItem row)
    {
        if (!row.IsUnique)
            return new ItemReference(new RegularItem
            {
                Id = row.ItemId,
                Count = (short)Math.Clamp(row.ItemCount, 0, short.MaxValue)
            });

        //A new id would make two of the same sword indistinguishable from one sword sold
        //twice, so the one it was listed with is carried through rather than regenerated.
        var unique = new UniqueItem
        {
            Id = row.ItemId,
            Count = (short)Math.Clamp(row.ItemCount, 0, short.MaxValue),
            Flags = row.ItemFlags,
            Refine = row.Refine,
            UniqueId = row.UniqueId == Guid.Empty ? Guid.NewGuid() : row.UniqueId,
        };

        unique.SetSlotData(0, row.Slot0);
        unique.SetSlotData(1, row.Slot1);
        unique.SetSlotData(2, row.Slot2);
        unique.SetSlotData(3, row.Slot3);

        return new ItemReference(unique);
    }
}
