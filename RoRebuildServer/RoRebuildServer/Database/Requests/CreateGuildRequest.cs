using Microsoft.EntityFrameworkCore;
using RoRebuildServer.Database.Domain;
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

        try
        {
            if (await dbContext.Guilds.AnyAsync(g => g.GuildName == GuildName))
            {
                CommandBuilder.ErrorMessage(Connection, "A guild with that name already exists.");
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
            CommandBuilder.ErrorMessage(Connection, "Error: could not create the guild.");
        }
    }
}
