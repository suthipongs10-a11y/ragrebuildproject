using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RoRebuildServer.Database.Domain;

/// <summary>
/// One bid that was made, kept after it has been beaten.
///
/// The auction row only ever holds the bid that is winning, because that is the only one
/// the money is on. This is the rest of them, and it exists for the people watching rather
/// than for the machinery: an auction showing only its current price says nothing about
/// whether it is being fought over or has sat untouched for a day, and those are the two
/// things somebody deciding whether to join in wants to know.
///
/// Written and never changed. A bid that happened happened, even after it is outbid.
/// </summary>
[Table("AuctionBid")]
public class DbAuctionBid
{
    [Key] public int Id { get; set; }

    public int AuctionId { get; set; }

    public Guid BidderId { get; set; }

    [MaxLength(40)] public string BidderName { get; set; } = "";

    public int Amount { get; set; }

    public DateTime PlacedAt { get; set; }
}
