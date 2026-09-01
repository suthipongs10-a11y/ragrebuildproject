using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// A smith's standing, kept on the weapons rather than on the smith.
    ///
    /// Two columns on the table that already records who forged what. The rank is what the
    /// maker's standing was at the moment the weapon was made, which is what the weapon
    /// shows and what it is worth; the points are what that weapon added to the standing,
    /// summed back up at startup to work out where the smith is now.
    ///
    /// Putting the running total here rather than on the character means nothing has to
    /// stay in step: the weapons are the record, and the total is derived from them. Both
    /// default to zero, so every weapon forged before this reads as the work of a smith
    /// with no name yet, which it was.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260902120000_AddForgerRank")]
    public partial class AddForgerRank : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ForgerRank",
                table: "ForgedItem",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "FamePoints",
                table: "ForgedItem",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ForgerRank", table: "ForgedItem");
            migrationBuilder.DropColumn(name: "FamePoints", table: "ForgedItem");
        }
    }
}
