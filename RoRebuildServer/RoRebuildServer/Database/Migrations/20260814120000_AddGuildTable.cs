using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Adds the guild table and the character's guild id. Deliberately has no foreign
    /// key: sqlite implements one by rebuilding the whole table, and the membership
    /// link is resolved in code anyway.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260814120000_AddGuildTable")]
    public partial class AddGuildTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Guild",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    GuildName = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    LeaderId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Guild", x => x.Id);
                });

            migrationBuilder.AddColumn<int>(
                name: "GuildId",
                table: "Character",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GuildId",
                table: "Character");

            migrationBuilder.DropTable(
                name: "Guild");
        }
    }
}
