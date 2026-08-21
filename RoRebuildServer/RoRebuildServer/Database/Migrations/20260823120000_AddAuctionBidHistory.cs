using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Every bid that was made, not only the one that is winning.
    ///
    /// For the people watching rather than for the machinery: a listing showing one price
    /// says nothing about whether it is being fought over.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260823120000_AddAuctionBidHistory")]
    public partial class AddAuctionBidHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuctionBid",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AuctionId = table.Column<int>(type: "INTEGER", nullable: false),
                    BidderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    BidderName = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Amount = table.Column<int>(type: "INTEGER", nullable: false),
                    PlacedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_AuctionBid", x => x.Id); });

            migrationBuilder.CreateIndex(
                name: "IX_AuctionBid_AuctionId",
                table: "AuctionBid",
                column: "AuctionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AuctionBid");
        }
    }
}
