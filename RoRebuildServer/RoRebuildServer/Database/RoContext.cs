using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database.Domain;

namespace RoRebuildServer.Database;

#pragma warning disable CS8618 // Disable null usage warnings, as it thinks dbsets can be null

public class RoContext : IdentityDbContext<RoUserAccount, UserRole, int>
{
    public RoContext(DbContextOptions<RoContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<RoUserAccount>().ToTable("DbUserAccount");
        builder.Entity<UserRole>().ToTable("DbRoles");

        builder.Entity<IdentityUserRole<int>>().ToTable("DbUserRoles");
        builder.Entity<IdentityRoleClaim<int>>().ToTable("DbRoleClaims");
        builder.Entity<IdentityUserClaim<int>>().ToTable("DbUserClaims");
        builder.Entity<IdentityUserLogin<int>>().ToTable("DbUserLogins");
        builder.Entity<IdentityUserToken<int>>().ToTable("DbUserTokens");

        builder.Entity<ScriptGlobalVar>().ToTable("ScriptGlobals");

        builder.Entity<RoUserAccount>().HasMany<DbCharacter>(c => c.Characters).WithOne(o => o.Account).HasForeignKey("AccountId");
        builder.Entity<DbCharacter>().HasIndex(c => c.Name).IsUnique();
        builder.Entity<RoUserAccount>().HasOne(u => u.CharacterStorage)
                                       .WithOne(u => u.Account)
                                       .HasForeignKey<StorageInventory>(s => s.AccountId);
        builder.Entity<DbCharacter>().HasOne(u => u.Party).WithMany(p => p.Characters).HasForeignKey(u => u.PartyId);

        //The two market queries that run on a timer rather than on a button: everything
        //waiting for one character, and everything due to pay out. Both would walk the
        //whole table without these, which is fine at ten rows and not at ten thousand.
        builder.Entity<DbInboxParcel>().HasIndex(p => p.CharacterId);
        builder.Entity<DbAuction>().HasIndex(a => new { a.IsSettled, a.EndsAt });

        //what is still being bought, which is both what the browser lists and what the
        //timer looks through for orders that have run out
        builder.Entity<DbBuyOrder>().HasIndex(o => new { o.IsClosed, o.EndsAt });

        //read whenever somebody opens a listing to see who is bidding on it
        builder.Entity<DbAuctionBid>().HasIndex(b => b.AuctionId);

        //keyed by the item's own guid rather than a row number, since that is what is
        //looked up and the item already carries it
        builder.Entity<DbForgedItem>().HasKey(f => f.UniqueId);
        builder.Entity<DbForgedItem>().Property(f => f.UniqueId).ValueGeneratedNever();
    }


    public DbSet<DbCharacter> Character { get; set; }
    public DbSet<StorageInventory> StorageInventory { get; set; }
    public DbSet<DbParty> Parties { get; set; }
    public DbSet<DbGuild> Guilds { get; set; }
    public DbSet<ScriptGlobalVar> ScriptGlobalVars { get; set; }
    public DbSet<DbAuction> Auctions { get; set; }
    public DbSet<DbInboxParcel> InboxParcels { get; set; }
    public DbSet<DbBuyOrder> BuyOrders { get; set; }
    public DbSet<DbAuctionBid> AuctionBids { get; set; }
    public DbSet<DbForgedItem> ForgedItems { get; set; }
}