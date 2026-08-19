using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Adds what a guild has been given and what it has left to spend. Both default to
    /// zero, which is what every guild that existed before this already is.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260820120000_AddGuildContribution")]
    public partial class AddGuildContribution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "Contribution",
                table: "Guild",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "SkillPoints",
                table: "Guild",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "SkillPoints", table: "Guild");
            migrationBuilder.DropColumn(name: "Contribution", table: "Guild");
        }
    }
}
