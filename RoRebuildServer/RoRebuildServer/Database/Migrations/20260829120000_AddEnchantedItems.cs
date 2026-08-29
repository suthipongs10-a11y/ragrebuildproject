using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// The options rolled onto a piece of equipment, keyed by the item's own guid.
    ///
    /// Same shape as the forged-item table and for the same reason: a UniqueItem is a
    /// fixed forty bytes with nowhere to put this, and the guid is what follows the item
    /// through a trade, the market and the ground.
    ///
    /// Stats are stored by name. See DbEnchantedItem for why.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260829120000_AddEnchantedItems")]
    public partial class AddEnchantedItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EnchantedItem",
                columns: table => new
                {
                    UniqueId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tier = table.Column<byte>(type: "INTEGER", nullable: false),
                    Stat1 = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Value1 = table.Column<int>(type: "INTEGER", nullable: false),
                    Stat2 = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Value2 = table.Column<int>(type: "INTEGER", nullable: false),
                    Stat3 = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Value3 = table.Column<int>(type: "INTEGER", nullable: false),
                    EnchantedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_EnchantedItem", x => x.UniqueId); });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "EnchantedItem");
        }
    }
}
