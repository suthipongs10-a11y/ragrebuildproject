using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// A standing offer to buy something, and how much of it is still wanted.
///
/// The money is not on the buyer at all while this row exists - the whole total left
/// their purse when they posted it, the same way an item leaves a bag when it is listed
/// for auction. That is the point of the feature: somebody selling into this is paid on
/// the spot, and being paid on the spot only works if the money is already here.
///
/// Only stackable items. A buy order names a thing by its number, and a +7 sword with two
/// cards in it is a different thing from a +0 one with the same number - so gear is left
/// to the auction house, where what is being sold can be looked at.
/// </summary>
[Table("BuyOrder")]
public class DbBuyOrder
{
    [Key] public int Id { get; set; }

    public Guid BuyerId { get; set; }

    [MaxLength(40)] public string BuyerName { get; set; } = "";

    public int ItemId { get; set; }

    /// <summary>How many were wanted when this was posted, for the window to show progress.</summary>
    public int WantedCount { get; set; }

    /// <summary>How many are still wanted. The escrow below is this times the price.</summary>
    public int RemainingCount { get; set; }

    public int PricePer { get; set; }

    public DateTime PostedAt { get; set; }

    public DateTime EndsAt { get; set; }

    /// <summary>
    /// Set once the row has paid out what it was holding, rather than deleting it.
    ///
    /// Same reason as an auction: closing means writing parcels, and a row deleted before
    /// those are written is money that no longer exists anywhere.
    /// </summary>
    public bool IsClosed { get; set; }
}
