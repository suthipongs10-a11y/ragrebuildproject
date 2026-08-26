using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// The names a character has chosen to remember.
    ///
    /// Indexed by owner, because every read of this table is "everyone on one person's
    /// list" and without it that is a scan of every friendship on the server to find
    /// forty rows.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260826120000_AddFriends")]
    public partial class AddFriends : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Friend",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OwnerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FriendId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FriendName = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    AddedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_Friend", x => x.Id); });

            migrationBuilder.CreateIndex(
                name: "IX_Friend_OwnerId",
                table: "Friend",
                column: "OwnerId");

            //One row per pair, so pressing remember twice cannot put the same person on a
            //list twice - which reads as a bug and is a nuisance to clean up afterwards.
            migrationBuilder.CreateIndex(
                name: "IX_Friend_OwnerId_FriendId",
                table: "Friend",
                columns: new[] { "OwnerId", "FriendId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Friend");
        }
    }
}
