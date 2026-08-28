using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RoRebuildServer.Database;

#nullable disable

namespace RoRebuildServer.Migrations
{
    /// <summary>
    /// Who is banned, and which account came in from which address.
    ///
    /// Both tables are read whole at startup and held in memory, so the indexes here are for
    /// the questions a GM asks rather than for the login path: everyone at one address, and
    /// every address one account has used.
    /// </summary>
    [DbContext(typeof(RoContext))]
    [Migration("20260828120000_AddBans")]
    public partial class AddBans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Ban",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AccountId = table.Column<int>(type: "INTEGER", nullable: false),
                    Address = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    AccountName = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Reason = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    BannedBy = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    BannedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_Ban", x => x.Id); });

            migrationBuilder.CreateIndex(name: "IX_Ban_AccountId", table: "Ban", column: "AccountId");
            migrationBuilder.CreateIndex(name: "IX_Ban_Address", table: "Ban", column: "Address");

            migrationBuilder.CreateTable(
                name: "AccountAddress",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AccountId = table.Column<int>(type: "INTEGER", nullable: false),
                    AccountName = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Address = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    FirstSeen = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LastSeen = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LoginCount = table.Column<int>(type: "INTEGER", nullable: false),
                },
                constraints: table => { table.PrimaryKey("PK_AccountAddress", x => x.Id); });

            //one row per pair, so a hundred logins from the same place stay one row
            migrationBuilder.CreateIndex(
                name: "IX_AccountAddress_AccountId_Address",
                table: "AccountAddress",
                columns: new[] { "AccountId", "Address" },
                unique: true);

            //the bot farm question: everyone who has ever come in from here
            migrationBuilder.CreateIndex(
                name: "IX_AccountAddress_Address",
                table: "AccountAddress",
                column: "Address");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Ban");
            migrationBuilder.DropTable(name: "AccountAddress");
        }
    }
}
