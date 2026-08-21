using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Standing offers to buy: what is wanted, how many are left, and what each is worth.
    ///
    /// No item columns beyond the number, unlike the auction table - a buy order is for a
    /// stackable thing, and gear whose refine and cards are the whole of its value belongs
    /// where it can be looked at before it is bought.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260822120000_AddBuyOrders")]
    public partial class AddBuyOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BuyOrder",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BuyerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    BuyerName = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    ItemId = table.Column<int>(type: "INTEGER", nullable: false),
                    WantedCount = table.Column<int>(type: "INTEGER", nullable: false),
                    RemainingCount = table.Column<int>(type: "INTEGER", nullable: false),
                    PricePer = table.Column<int>(type: "INTEGER", nullable: false),
                    PostedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsClosed = table.Column<bool>(type: "INTEGER", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_BuyOrder", x => x.Id); });

            migrationBuilder.CreateIndex(
                name: "IX_BuyOrder_IsClosed_EndsAt",
                table: "BuyOrder",
                columns: new[] { "IsClosed", "EndsAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "BuyOrder");
        }
    }
}
