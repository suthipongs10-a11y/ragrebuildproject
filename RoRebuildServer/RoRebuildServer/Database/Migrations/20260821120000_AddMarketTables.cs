using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// The two tables the market runs on: what is up for auction, and what is waiting to
    /// be collected.
    ///
    /// Both hold items as plain columns rather than a blob, because an auction that will
    /// not pay out is something somebody has to be able to look at.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260821120000_AddMarketTables")]
    public partial class AddMarketTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Auction",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SellerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SellerName = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    ItemId = table.Column<int>(type: "INTEGER", nullable: false),
                    ItemCount = table.Column<int>(type: "INTEGER", nullable: false),
                    IsUnique = table.Column<bool>(type: "INTEGER", nullable: false),
                    Refine = table.Column<byte>(type: "INTEGER", nullable: false),
                    ItemFlags = table.Column<byte>(type: "INTEGER", nullable: false),
                    UniqueId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Slot0 = table.Column<int>(type: "INTEGER", nullable: false),
                    Slot1 = table.Column<int>(type: "INTEGER", nullable: false),
                    Slot2 = table.Column<int>(type: "INTEGER", nullable: false),
                    Slot3 = table.Column<int>(type: "INTEGER", nullable: false),
                    StartPrice = table.Column<int>(type: "INTEGER", nullable: false),
                    HighBid = table.Column<int>(type: "INTEGER", nullable: false),
                    HighBidderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    HighBidderName = table.Column<string>(type: "TEXT", maxLength: 40, nullable: true),
                    ListedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsSettled = table.Column<bool>(type: "INTEGER", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_Auction", x => x.Id); });

            migrationBuilder.CreateTable(
                name: "InboxParcel",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CharacterId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Reason = table.Column<byte>(type: "INTEGER", nullable: false),
                    FromName = table.Column<string>(type: "TEXT", maxLength: 40, nullable: true),
                    Zeny = table.Column<int>(type: "INTEGER", nullable: false),
                    ItemId = table.Column<int>(type: "INTEGER", nullable: false),
                    ItemCount = table.Column<int>(type: "INTEGER", nullable: false),
                    IsUnique = table.Column<bool>(type: "INTEGER", nullable: false),
                    Refine = table.Column<byte>(type: "INTEGER", nullable: false),
                    ItemFlags = table.Column<byte>(type: "INTEGER", nullable: false),
                    UniqueId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Slot0 = table.Column<int>(type: "INTEGER", nullable: false),
                    Slot1 = table.Column<int>(type: "INTEGER", nullable: false),
                    Slot2 = table.Column<int>(type: "INTEGER", nullable: false),
                    Slot3 = table.Column<int>(type: "INTEGER", nullable: false),
                    SentAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_InboxParcel", x => x.Id); });

            //what is due to pay out, and what is waiting for one character - the two
            //queries that run without anybody pressing a button
            migrationBuilder.CreateIndex(
                name: "IX_Auction_IsSettled_EndsAt",
                table: "Auction",
                columns: new[] { "IsSettled", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxParcel_CharacterId",
                table: "InboxParcel",
                column: "CharacterId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Auction");
            migrationBuilder.DropTable(name: "InboxParcel");
        }
    }
}
