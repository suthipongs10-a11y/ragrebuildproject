using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Guilds;

namespace RoRebuildServer.Database.Requests;

public class CreateGuildRequest : IDbRequest
{
    public NetworkConnection Connection;
    public string GuildName;

    public CreateGuildRequest(NetworkConnection connection, string guildName)
    {
        Connection = connection;
        GuildName = guildName;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var player = Connection.Player;
        if (player == null || Connection.Character == null || !Connection.IsConnectedAndInGame)
            return;

        if (player.Guild != null)
        {
            CommandBuilder.ErrorMessage(Connection, "You are already in a guild.");
            return;
        }

        //Held outside the try so the catch can put it back. Zero means nothing was taken.
        var charterId = 0;

        try
        {
            if (await dbContext.Guilds.AnyAsync(g => g.GuildName == GuildName))
            {
                CommandBuilder.ErrorMessage(Connection, "A guild with that name already exists.");
                return;
            }

            //Taken here rather than when the command was typed. That check has already
            //happened and is worth having - it answers instantly - but the guild is created
            //on this side, and between the two the player can sell, drop or trade the
            //thing. This is the one that decides, and it is done before any row is written
            //so a player without one leaves with the database untouched.
            if (!GuildCommands.TryGetCharterItem(out charterId)
                || !player.TryRemoveItemFromInventory(charterId, 1, true))
            {
                charterId = 0;
                CommandBuilder.ErrorMessage(Connection, "Founding a guild takes an Emperium. Bring one and try again.");
                return;
            }

            var dbGuild = new DbGuild { GuildName = GuildName, LeaderId = player.Id };
            dbContext.Guilds.Add(dbGuild);
            await dbContext.SaveChangesAsync();

            await dbContext.Character.Where(c => c.Id == player.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.GuildId, dbGuild.Id));

            var guild = new Guild(dbGuild);
            guild.AddMember(player.Id, player.Name);
            guild = GuildManager.Register(guild);
            player.Guild = guild;

            CommandBuilder.AddRecipient(Connection);
            CommandBuilder.SendServerMessage($"Guild \"{guild.GuildName}\" has been founded. You are its leader.");
            CommandBuilder.ClearRecipients();
        }
        catch (Exception e)
        {
            ServerLogger.LogWarning("Create guild failed due to exception. Exception: " + e.Message);

            //The emperium was taken before the rows were written, so if the writing is what
            //failed the player is owed it back. Charging somebody for a guild they did not
            //get is the kind of thing that is remembered.
            if (charterId > 0)
                player.CreateItemInInventory(new ItemReference(charterId, 1));

            CommandBuilder.ErrorMessage(Connection, "Error: could not create the guild.");
        }
    }
}
