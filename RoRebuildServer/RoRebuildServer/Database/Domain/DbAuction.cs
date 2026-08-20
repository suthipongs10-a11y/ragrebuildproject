using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// One thing up for auction, and where the bidding has got to.
///
/// The item is not in anybody's bag while this row exists - it left the seller's when they
/// listed it, and it reaches somebody's parcel box when the row is settled. That is the
/// whole reason the row holds the item rather than pointing at one: an item that lives in
/// two places at once is an item that can be sold twice.
///
/// The same is true of the money. A bid leaves the bidder's purse the moment it is made,
/// so the highest bid is always a bid somebody can actually pay; being outbid sends it
/// back. Anything else means an auction that ends and cannot be paid for.
/// </summary>
[Table("Auction")]
public class DbAuction : IDbMarketItem
{
    [Key] public int Id { get; set; }

    public Guid SellerId { get; set; }

    [MaxLength(40)] public string SellerName { get; set; } = "";

    public int ItemId { get; set; }
    public int ItemCount { get; set; }
    public bool IsUnique { get; set; }
    public byte Refine { get; set; }
    public byte ItemFlags { get; set; }
    public Guid UniqueId { get; set; }
    public int Slot0 { get; set; }
    public int Slot1 { get; set; }
    public int Slot2 { get; set; }
    public int Slot3 { get; set; }

    /// <summary>What bidding opens at. The first bid may match it; later ones must beat it.</summary>
    public int StartPrice { get; set; }

    /// <summary>The standing bid, or zero if nobody has bid yet.</summary>
    public int HighBid { get; set; }

    /// <summary>Who is winning, or empty. Their money is held on this row.</summary>
    public Guid HighBidderId { get; set; }

    [MaxLength(40)] public string? HighBidderName { get; set; }

    public DateTime ListedAt { get; set; }

    /// <summary>When it pays out. Checked on a timer, so it may settle a few seconds late.</summary>
    public DateTime EndsAt { get; set; }

    /// <summary>
    /// Set once the row has paid out, rather than deleting it.
    ///
    /// Settling means writing several parcels, and a row deleted before those are written
    /// is an item that no longer exists anywhere. Marking it means the worst case is a
    /// parcel written twice, which is a thing somebody notices, rather than an item that
    /// silently evaporates.
    /// </summary>
    public bool IsSettled { get; set; }
}
