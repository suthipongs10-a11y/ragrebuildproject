using System.Diagnostics;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RebuildSharedData.Networking;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Simulation;
using RoRebuildServer.Simulation.Guilds;

namespace RoRebuildServer.Networking.PacketHandlers.Guilds;

/// <summary>
/// Everything the guild window asks for, behind one packet with an action byte.
///
/// One handler rather than seven, because they all move the same shapes and every extra
/// packet type is another chance for the two sides to disagree about what is on the wire.
/// The chat commands in GuildCommands still work and are untouched; this is the same
/// operations reached from a window instead of from typing.
/// </summary>
[ClientPacketHandler(PacketType.GuildAction)]
public class PacketGuildAction : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame)
            return;

        Debug.Assert(connection.Player != null);

        var player = connection.Player;
        var action = (GuildRequestType)msg.ReadByte();

        switch (action)
        {
            case GuildRequestType.Refresh:
                CommandBuilder.SendGuildData(player);
                break;

            case GuildRequestType.ListGuilds:
                CommandBuilder.SendGuildList(player, GuildManager.AllLoadedGuilds());
                break;

            case GuildRequestType.RequestJoin:
                RequestJoin(connection, player, msg.ReadInt32());
                break;

            case GuildRequestType.Leave:
                Leave(connection, player);
                break;

            case GuildRequestType.Kick:
                Kick(connection, player, msg.ReadString());
                break;

            case GuildRequestType.ApproveRequest:
                AnswerRequest(connection, player, msg.ReadString(), true);
                break;

            case GuildRequestType.RejectRequest:
                AnswerRequest(connection, player, msg.ReadString(), false);
                break;
        }
    }

    private static void RequestJoin(NetworkConnection connection, Player player, int guildId)
    {
        if (player.Guild != null)
        {
            CommandBuilder.ErrorMessage(connection, "คุณอยู่ในกิลด์อื่นอยู่แล้ว");
            return;
        }

        //Checked before anything else that could succeed, so the answer is the same whether
        //the guild is full, gone, or fine: you left one recently and that is that.
        var wait = GuildCooldown.SecondsRemaining(player);
        if (wait > 0)
        {
            CommandBuilder.ErrorMessage(connection,
                $"คุณเพิ่งออกจากกิลด์ ต้องรอ {GuildCooldown.Describe(wait)} ถึงจะเข้ากิลด์ใหม่ได้");
            return;
        }

        if (!GuildManager.TryGetGuild(guildId, out var guild))
        {
            CommandBuilder.ErrorMessage(connection, "ไม่พบกิลด์นี้แล้ว");
            return;
        }

        if (guild.IsFull)
        {
            CommandBuilder.ErrorMessage(connection, $"กิลด์ {guild.GuildName} เต็มแล้ว ({Guild.MaxMembers} คน)");
            return;
        }

        if (!guild.AddJoinRequest(player.Id, player.Name))
        {
            CommandBuilder.ErrorMessage(connection, "ส่งคำขอไปแล้ว รอหัวหน้ากิลด์ตอบก่อนนะ");
            return;
        }

        //the leader is the only one who can answer, and only if they are here to see it
        if (World.Instance.TryFindPlayerByName(LeaderName(guild), out var leaderEntity))
            CommandBuilder.SendGuildData(leaderEntity.Get<Player>());

        //so the applicant's own window can grey the button out
        CommandBuilder.SendGuildList(player, GuildManager.AllLoadedGuilds());
    }

    private static void Leave(NetworkConnection connection, Player player)
    {
        var guild = player.Guild;
        if (guild == null)
            return;

        if (guild.IsLeader(player))
        {
            CommandBuilder.ErrorMessage(connection, "หัวหน้ากิลด์ออกจากกิลด์เองไม่ได้");
            return;
        }

        guild.RemoveMember(player.Id);
        player.Guild = null;
        RoDatabase.EnqueueDbRequest(new GuildMembershipRequest(GuildMembershipAction.Leave, player.Id, guild.GuildId));

        //Only here, and not where somebody is thrown out: leaving is a choice and waiting a
        //day is its price. Being kicked is not, and charging for it would hand every leader
        //a way to bench somebody for a day.
        GuildCooldown.StartFor(player);

        CommandBuilder.ErrorMessage(connection,
            $"ออกจากกิลด์แล้ว เข้ากิลด์ใหม่ได้อีกครั้งใน 24 ชั่วโมง");
        guild.Announce($"{player.Name} ออกจากกิลด์แล้ว");
        CommandBuilder.SendGuildData(player);
    }

    private static void Kick(NetworkConnection connection, Player player, string targetName)
    {
        var guild = player.Guild;
        if (guild == null || !guild.IsLeader(player))
        {
            CommandBuilder.ErrorMessage(connection, "เฉพาะหัวหน้ากิลด์เท่านั้นที่ทำได้");
            return;
        }

        var member = guild.FindMemberByName(targetName);
        if (member == null)
        {
            CommandBuilder.ErrorMessage(connection, $"ไม่พบ {targetName} ในกิลด์");
            return;
        }

        if (member.CharacterId == guild.LeaderId)
        {
            CommandBuilder.ErrorMessage(connection, "ไล่หัวหน้ากิลด์ออกไม่ได้");
            return;
        }

        guild.RemoveMember(member.CharacterId);
        RoDatabase.EnqueueDbRequest(new GuildMembershipRequest(GuildMembershipAction.Leave, member.CharacterId, guild.GuildId));

        //cleared on the live player too, if they are on to notice
        if (World.Instance.TryFindPlayerByName(member.Name, out var kickedEntity))
        {
            var kicked = kickedEntity.Get<Player>();
            kicked.Guild = null;
            CommandBuilder.SendGuildData(kicked);
        }

        guild.Announce($"{member.Name} ถูกให้ออกจากกิลด์");
        CommandBuilder.SendGuildData(player);
    }

    private static void AnswerRequest(NetworkConnection connection, Player player, string applicantName, bool approve)
    {
        var guild = player.Guild;
        if (guild == null || !guild.IsLeader(player))
        {
            CommandBuilder.ErrorMessage(connection, "เฉพาะหัวหน้ากิลด์เท่านั้นที่ทำได้");
            return;
        }

        GuildJoinRequest? request = null;
        foreach (var pending in guild.JoinRequests)
        {
            if (!string.Equals(pending.Name, applicantName, StringComparison.OrdinalIgnoreCase))
                continue;
            request = pending;
            break;
        }

        if (request == null)
        {
            CommandBuilder.ErrorMessage(connection, $"ไม่มีคำขอจาก {applicantName} แล้ว");
            return;
        }

        guild.RemoveJoinRequest(request.CharacterId);

        var online = World.Instance.TryFindPlayerByName(request.Name, out var applicantEntity);
        var applicant = online ? applicantEntity.Get<Player>() : null;

        if (!approve)
        {
            if (applicant != null)
                CommandBuilder.ErrorMessage(applicant.Connection, $"กิลด์ {guild.GuildName} ปฏิเสธคำขอของคุณ");
            CommandBuilder.SendGuildData(player);
            return;
        }

        //Checked again here rather than only when the request went in. Between asking and
        //being answered the guild can fill up and the applicant can join somewhere else,
        //and either one would otherwise put a member on a roster that cannot hold them.
        if (guild.IsFull)
        {
            CommandBuilder.ErrorMessage(connection, "กิลด์เต็มแล้ว รับเพิ่มไม่ได้");
            CommandBuilder.SendGuildData(player);
            return;
        }

        if (applicant == null)
        {
            CommandBuilder.ErrorMessage(connection, $"{request.Name} ออฟไลน์ไปแล้ว ให้ขอเข้ามาใหม่อีกครั้ง");
            CommandBuilder.SendGuildData(player);
            return;
        }

        if (applicant.Guild != null)
        {
            CommandBuilder.ErrorMessage(connection, $"{request.Name} เข้ากิลด์อื่นไปแล้ว");
            CommandBuilder.SendGuildData(player);
            return;
        }

        guild.AddMember(applicant.Id, applicant.Name);
        guild.UpdateMemberDetails(applicant.Id, applicant.GetData(PlayerStat.Job), applicant.CharacterLevel);
        applicant.Guild = guild;
        RoDatabase.EnqueueDbRequest(new GuildMembershipRequest(GuildMembershipAction.Join, applicant.Id, guild.GuildId));

        guild.Announce($"{applicant.Name} เข้าร่วมกิลด์แล้ว");
        CommandBuilder.SendGuildData(player);
        CommandBuilder.SendGuildData(applicant);
    }

    /// <summary>The leader's name, which the roster holds even though the guild only stores an id.</summary>
    private static string LeaderName(Guild guild)
    {
        var leader = guild.FindMember(guild.LeaderId);
        return leader?.Name ?? "";
    }
}
