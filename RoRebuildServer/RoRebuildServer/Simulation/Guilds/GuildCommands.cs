using System.Text;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Simulation.Guilds;

/// <summary>
/// Guild handling driven from the chat box, so no new packets or client windows are
/// needed. Everything runs through /guild followed by a sub command.
/// </summary>
public static class GuildCommands
{
    private const float InviteTimeoutSeconds = 60f;

    private class PendingInvite
    {
        public int GuildId;
        public string GuildName = "";
        public float Expiry;
    }

    private static readonly Dictionary<Guid, PendingInvite> PendingInvites = new();

    public static void Handle(NetworkConnection connection, string arguments)
    {
        var player = connection.Player;
        if (player == null || connection.Character == null)
            return;

        var trimmed = (arguments ?? "").Trim();
        var split = trimmed.IndexOf(' ');
        var command = (split < 0 ? trimmed : trimmed.Substring(0, split)).ToLowerInvariant();
        var rest = split < 0 ? "" : trimmed.Substring(split + 1).Trim();

        switch (command)
        {
            case "create": CreateGuild(connection, player, rest); break;
            case "info": ShowInfo(connection, player); break;
            case "invite": InviteMember(connection, player, rest); break;
            case "join": AcceptInvite(connection, player); break;
            case "leave": LeaveGuild(connection, player); break;
            default: ShowUsage(connection); break;
        }
    }

    private static void ShowUsage(NetworkConnection connection)
    {
        Message(connection,
            "Guild commands: /guild create <name>, /guild info, /guild invite <player>, /guild join, /guild leave");
    }

    private static void CreateGuild(NetworkConnection connection, Player player, string name)
    {
        if (player.Guild != null)
        {
            CommandBuilder.ErrorMessage(connection, "You are already in a guild.");
            return;
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            CommandBuilder.ErrorMessage(connection, "Usage: /guild create <name>");
            return;
        }

        if (name.Length > Guild.MaxNameLength)
        {
            CommandBuilder.ErrorMessage(connection, $"A guild name can be at most {Guild.MaxNameLength} characters long.");
            return;
        }

        RoDatabase.EnqueueDbRequest(new CreateGuildRequest(connection, name));
    }

    private static void ShowInfo(NetworkConnection connection, Player player)
    {
        var guild = player.Guild;
        if (guild == null)
        {
            Message(connection, "You are not in a guild. Use /guild create <name> to found one.");
            return;
        }

        var online = 0;
        var builder = new StringBuilder();
        foreach (var member in guild.Members)
        {
            var isOnline = World.Instance.TryFindPlayerByName(member.Name, out _);
            if (isOnline)
                online++;

            if (builder.Length > 0)
                builder.Append(", ");
            builder.Append(member.CharacterId == guild.LeaderId ? $"{member.Name} (leader)" : member.Name);
            if (!isOnline)
                builder.Append(" [offline]");
        }

        Message(connection, $"Guild \"{guild.GuildName}\" - {guild.Members.Count} member(s), {online} online.");
        Message(connection, $"Members: {builder}");
    }

    private static void InviteMember(NetworkConnection connection, Player player, string targetName)
    {
        var guild = player.Guild;
        if (guild == null)
        {
            CommandBuilder.ErrorMessage(connection, "You are not in a guild.");
            return;
        }

        if (!guild.IsLeader(player))
        {
            CommandBuilder.ErrorMessage(connection, "Only the guild leader can invite members.");
            return;
        }

        if (string.IsNullOrWhiteSpace(targetName))
        {
            CommandBuilder.ErrorMessage(connection, "Usage: /guild invite <player>");
            return;
        }

        if (guild.Members.Count >= Guild.MaxMembers)
        {
            CommandBuilder.ErrorMessage(connection, "Your guild is full.");
            return;
        }

        if (!World.Instance.TryFindPlayerByName(targetName, out var targetEntity)
            || !targetEntity.TryGet<Player>(out var target))
        {
            CommandBuilder.ErrorMessage(connection, $"No player named \"{targetName}\" is online.");
            return;
        }

        if (target == player)
        {
            CommandBuilder.ErrorMessage(connection, "You cannot invite yourself.");
            return;
        }

        if (target.Guild != null)
        {
            CommandBuilder.ErrorMessage(connection, $"{target.Name} is already in a guild.");
            return;
        }

        PendingInvites[target.Id] = new PendingInvite
        {
            GuildId = guild.GuildId,
            GuildName = guild.GuildName,
            Expiry = Time.ElapsedTimeFloat + InviteTimeoutSeconds
        };

        Message(connection, $"Invited {target.Name} to the guild.");

        if (target.Connection != null)
            Message(target.Connection,
                $"{player.Name} has invited you to the guild \"{guild.GuildName}\". Type /guild join to accept.");
    }

    private static void AcceptInvite(NetworkConnection connection, Player player)
    {
        if (player.Guild != null)
        {
            CommandBuilder.ErrorMessage(connection, "You are already in a guild.");
            return;
        }

        //The same wait the window enforces. Checked here as well or an invite would be the
        //way around it, and a rule with a way around it is not a rule.
        var wait = GuildCooldown.SecondsRemaining(player);
        if (wait > 0)
        {
            CommandBuilder.ErrorMessage(connection,
                $"คุณเพิ่งออกจากกิลด์ ต้องรอ {GuildCooldown.Describe(wait)} ถึงจะเข้ากิลด์ใหม่ได้");
            return;
        }

        if (!PendingInvites.TryGetValue(player.Id, out var invite))
        {
            CommandBuilder.ErrorMessage(connection, "You have no pending guild invitation.");
            return;
        }

        PendingInvites.Remove(player.Id);

        if (invite.Expiry < Time.ElapsedTimeFloat)
        {
            CommandBuilder.ErrorMessage(connection, "That guild invitation has expired.");
            return;
        }

        if (!GuildManager.TryGetGuild(invite.GuildId, out var guild))
        {
            CommandBuilder.ErrorMessage(connection, "That guild no longer exists.");
            return;
        }

        if (guild.Members.Count >= Guild.MaxMembers)
        {
            CommandBuilder.ErrorMessage(connection, "That guild is full.");
            return;
        }

        guild.AddMember(player.Id, player.Name);
        player.Guild = guild;
        player.UpdateStats(); //picks up the guild's skills, and the mark that says they are working
        RoDatabase.EnqueueDbRequest(new GuildMembershipRequest(GuildMembershipAction.Join, player.Id, guild.GuildId));

        guild.Announce($"{player.Name} has joined the guild.");
    }

    private static void LeaveGuild(NetworkConnection connection, Player player)
    {
        var guild = player.Guild;
        if (guild == null)
        {
            CommandBuilder.ErrorMessage(connection, "You are not in a guild.");
            return;
        }

        //the leader stepping out takes the guild with them, there is no succession yet
        if (guild.IsLeader(player))
        {
            guild.Announce($"The guild \"{guild.GuildName}\" has been disbanded.");

            foreach (var member in guild.Members)
            {
                if (World.Instance.TryFindPlayerByName(member.Name, out var entity)
                    && entity.TryGet<Player>(out var online))
                {
                    online.Guild = null;
                    online.UpdateStats(); //the guild is gone, so what it was giving has to go with it
                }
            }

            guild.Members.Clear();
            GuildManager.Remove(guild.GuildId);
            RoDatabase.EnqueueDbRequest(new GuildMembershipRequest(GuildMembershipAction.Disband, player.Id, guild.GuildId));
            return;
        }

        guild.RemoveMember(player.Id);
        player.Guild = null;
        player.UpdateStats(); //without this they keep the guild's stats until something else recalculates
        RoDatabase.EnqueueDbRequest(new GuildMembershipRequest(GuildMembershipAction.Leave, player.Id, guild.GuildId));

        //typed rather than clicked, but it is the same decision and carries the same wait
        GuildCooldown.StartFor(player);

        guild.Announce($"{player.Name} has left the guild.");
        Message(connection, $"You have left \"{guild.GuildName}\". You can join another guild in 24 hours.");
    }

    private static void Message(NetworkConnection connection, string text)
    {
        CommandBuilder.AddRecipient(connection);
        CommandBuilder.SendServerMessage(text);
        CommandBuilder.ClearRecipients();
    }
}
