using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Who forged a weapon, keyed by the weapon's own guid.
    ///
    /// There is nowhere in a UniqueItem to keep it - the struct is a fixed forty bytes and
    /// its spare slots are the card slots, which a forged weapon has already filled.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260824120000_AddForgedItems")]
    public partial class AddForgedItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ForgedItem",
                columns: table => new
                {
                    UniqueId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ForgerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ForgerName = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    ForgedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_ForgedItem", x => x.UniqueId); });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ForgedItem");
        }
    }
}
