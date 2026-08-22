using System.Diagnostics;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildZoneServer.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Simulation.Items;

public struct GroundItem : IEquatable<GroundItem>
{
    public int Id = -1;
    public int ContributorId = -1;
    public float ExclusiveTime;
    public float Expiration;
    public ItemType Type;

    /// <summary>
    /// How unlikely this drop was, on a scale of nothing special to almost never: 0, 1, 2, 3.
    ///
    /// Only the server knows it — the client has the item but not the odds of the monster
    /// parting with it — and it is the whole of what the client needs to decide whether the
    /// thing on the ground deserves to glow. What colour it glows is decided over there,
    /// where the item's own class already is.
    /// </summary>
    public byte Rarity;

    /// <summary>
    /// Whether what dropped this was a boss, which the client cannot work out for itself:
    /// the item on the ground says nothing about what died to leave it there. It is what
    /// separates a card off an MVP from a card off anything else, and the two are worth
    /// telling apart at a glance.
    /// </summary>
    public bool FromBoss;

    /// <summary>
    /// The monster whose death put this on the ground, or 0 when nothing died for it - a
    /// player's own drop, an NPC handout, or loot a monster had merely picked up off the
    /// floor first. Monster ids start well above zero, so a zeroed struct reads as "no
    /// source" on its own.
    ///
    /// The id rather than the name because this struct is stack allocated a page at a time
    /// in FindRandomGroundItemInRange, and one reference field would make that illegal.
    ///
    /// The card announcement reads this rather than the item alone. Going by the item
    /// meant anyone could drop a card, take it back, and put the line across every screen
    /// on the server, over and over, for free.
    /// </summary>
    public int DropSourceMonsterId;

    public FloatPosition Position;
    public RegularItem Item;
    public UniqueItem UniqueItem;

    public GroundItem(Position tile, int id, int count)
    {
        var data = DataManager.ItemList[id];
        if (!data.IsUnique)
            InitializeRegularItem(tile, new RegularItem() { Id = id, Count = (short)count });
        else
            InitializeUniqueItem(tile, new UniqueItem() { Id = id, Count = (short)count, UniqueId = Guid.NewGuid() });
    }

    public GroundItem(Position tile, ref ItemReference item)
    {
        if (item.Type == ItemType.RegularItem)
            InitializeRegularItem(tile, item.Item);
        else
            InitializeUniqueItem(tile, item.UniqueItem);
    }

    public GroundItem(Position tile, RegularItem item) => InitializeRegularItem(tile, item);

    public GroundItem(Position tile, UniqueItem item) => InitializeUniqueItem(tile, item);

    public void SetExclusivePickupTime(WorldObject src, float expiration)
    {
        ContributorId = src.Id;
        ExclusiveTime = Time.ElapsedTimeFloat + expiration;
    }

    public void InitializeUniqueItem(Position tile, UniqueItem item)
    {
        Debug.Assert(item.Id > 0);
        Debug.Assert(item.Count > 0);
        Id = World.Instance.GetNextDropId();
        Position = new FloatPosition(tile.X + GameRandom.NextFloat(0.1f, 0.9f), tile.Y + GameRandom.NextFloat(0.1f, 0.9f));
        Type = ItemType.UniqueItem;
        UniqueItem = item;
        Expiration = Time.ElapsedTimeFloat + 60f;
    }

    private void InitializeRegularItem(Position tile, RegularItem item)
    {
        Debug.Assert(item.Id > 0);
        Debug.Assert(item.Count > 0);
        Id = World.Instance.GetNextDropId();
        Position = new FloatPosition(tile.X + GameRandom.NextFloat(0.1f, 0.9f), tile.Y + GameRandom.NextFloat(0.1f, 0.9f));
        Type = ItemType.RegularItem;
        Item = item;
        Expiration = Time.ElapsedTimeFloat + 60f;
    }

    public ItemReference ToItemReference()
    {
#if DEBUG
        if (Type == ItemType.RegularItem)
            Debug.Assert(Item.Id != 0 && Item.Count != 0);
        if (Type == ItemType.UniqueItem)
            Debug.Assert(UniqueItem.Id != 0 && UniqueItem.Count != 0);
#endif

        return new ItemReference() { Type = Type, Item = Item, UniqueItem = UniqueItem };
    }

    public void Serialize(OutboundMessage msg)
    {
        Debug.Assert(Id != -1);

        msg.Write(Id);
        msg.Write(Position.X);
        msg.Write(Position.Y);

        //A unique item used to go down as its id and count alone, which is why a +9 triple
        //crumb sword lying on the ground read as "Blade". It goes down whole now: the
        //refine, the cards and the guid the smith's name hangs off are all part of what the
        //thing on the floor is, and a label that leaves them out is describing a different
        //item. Thirty-four bytes more, and only on the drops that are unique at all.
        msg.Write(Type == ItemType.UniqueItem);

        if (Type == ItemType.RegularItem)
            Item.Serialize(msg);
        else
            UniqueItem.Serialize(msg);

        msg.Write(Rarity);
        msg.Write(FromBoss);
    }

    public bool Equals(GroundItem other)
    {
        return Id == other.Id;
    }

    public override bool Equals(object? obj)
    {
        return obj is GroundItem other && Equals(other);
    }

    public override int GetHashCode()
    {
        return Id;
    }

    public static bool operator ==(GroundItem left, GroundItem right) => left.Equals(right);

    public static bool operator !=(GroundItem left, GroundItem right) => !left.Equals(right);
}