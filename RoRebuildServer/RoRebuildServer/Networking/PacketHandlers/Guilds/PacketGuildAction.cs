using System.Diagnostics;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RebuildSharedData.Networking;
using RoRebuildServer.Data;
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

            case GuildRequestType.SetTitle:
                SetTitle(connection, player, msg.ReadString());
                break;

            case GuildRequestType.SetEmblem:
                SetEmblem(connection, player, msg.ReadInt32());
                break;

            case GuildRequestType.Donate:
                Donate(connection, player, msg.ReadInt32(), msg.ReadInt32());
                break;

            case GuildRequestType.LearnSkill:
                LearnSkill(connection, player, (GuildSkill)msg.ReadInt32());
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
        player.UpdateStats(); //without this they keep the guild's stats until something else recalculates
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

    /// <summary>
    /// The leader names the guild, a second time.
    ///
    /// The title hangs off the guild's name on every member's plate, so setting it changes
    /// what other people see above forty characters at once. Everyone online in the guild
    /// is refreshed on the map so the change is visible without relogging - which for a
    /// name plate is the difference between a feature and a rumour.
    /// </summary>
    private static void SetTitle(NetworkConnection connection, Player player, string title)
    {
        var guild = player.Guild;
        if (guild == null || !guild.IsLeader(player))
        {
            CommandBuilder.ErrorMessage(connection, "เฉพาะหัวหน้ากิลด์เท่านั้นที่ทำได้");
            return;
        }

        title = title.Trim();
        if (title.Length > Guild.MaxTitleLength)
        {
            CommandBuilder.ErrorMessage(connection, $"ฉายายาวได้ไม่เกิน {Guild.MaxTitleLength} ตัวอักษร");
            return;
        }

        //The plate is drawn from this, so a title carrying markup would let one player
        //write coloured text over everyone else's screen. Only the characters a name is
        //made of are allowed through.
        foreach (var c in title)
        {
            if (char.IsControl(c) || c == '<' || c == '>')
            {
                CommandBuilder.ErrorMessage(connection, "ฉายามีตัวอักษรที่ใช้ไม่ได้");
                return;
            }
        }

        guild.GuildTitle = title;
        RoDatabase.EnqueueDbRequest(new GuildTitleRequest(guild.GuildId, title));

        //Every member online, not just the leader. The window showing the new title is the
        //confirmation, the same as it is for every other action here, and the refresh on
        //the map is what redraws the forty name plates the title now hangs on.
        foreach (var member in guild.Members)
        {
            if (!World.Instance.TryFindPlayerByName(member.Name, out var entity))
                continue;

            var online = entity.Get<Player>();
            CommandBuilder.SendGuildData(online);
            online.Character.Map?.RefreshEntity(online.Character);
        }

    }

    /// <summary>
    /// The leader picks the guild's mark.
    ///
    /// Only the number travels: the pictures are the game's own icons and live in the
    /// client, so the server has nothing to check but the range. Refusing one outside it
    /// matters anyway - a number the client has no picture for would leave every member
    /// wearing nothing, with no way to tell that from having chosen nothing.
    /// </summary>
    private static void SetEmblem(NetworkConnection connection, Player player, int emblem)
    {
        var guild = player.Guild;
        if (guild == null || !guild.IsLeader(player))
        {
            CommandBuilder.ErrorMessage(connection, "เฉพาะหัวหน้ากิลด์เท่านั้นที่ทำได้");
            return;
        }

        if (emblem < 0 || emblem > Guild.MaxEmblemId)
        {
            CommandBuilder.ErrorMessage(connection, "ไม่มีโลโก้แบบนั้น");
            return;
        }

        guild.EmblemId = emblem;
        RoDatabase.EnqueueDbRequest(new GuildEmblemRequest(guild.GuildId, emblem));

        //Same as the title: the emblem hangs on every member's name plate, so everyone
        //online is redrawn rather than left showing the old one until they relog.
        foreach (var member in guild.Members)
        {
            if (!World.Instance.TryFindPlayerByName(member.Name, out var entity))
                continue;

            var online = entity.Get<Player>();
            CommandBuilder.SendGuildData(online);
            online.Character.Map?.RefreshEntity(online.Character);
        }
    }

    /// <summary>
    /// A member hands a stack of something over, and the guild is worth more for it.
    ///
    /// Everything is checked before the items leave the bag, the same as a trade: what is
    /// worth donating, whether they still have that many, and whether they have anything
    /// left of today's allowance. Only then does anything move, so a refusal at any point
    /// costs the player nothing.
    /// </summary>
    private static void Donate(NetworkConnection connection, Player player, int bagId, int count)
    {
        var guild = player.Guild;
        if (guild == null)
        {
            CommandBuilder.ErrorMessage(connection, "คุณยังไม่ได้อยู่ในกิลด์");
            return;
        }

        if (count <= 0)
            return;

        var bag = player.Inventory;
        if (bag == null || !bag.GetItem(bagId, out var item) || bag.GetItemCountByBagId(bagId) < count)
        {
            CommandBuilder.ErrorMessage(connection, "ของไม่พอ");
            return;
        }

        if (player.Equipment != null && player.Equipment.IsItemEquipped(bagId))
        {
            CommandBuilder.ErrorMessage(connection, "ของที่ใส่อยู่บริจาคไม่ได้");
            return;
        }

        var per = GuildDonation.PointsFor(item.Id, out var refusal);
        if (per <= 0)
        {
            CommandBuilder.ErrorMessage(connection, refusal);
            return;
        }

        var remaining = GuildDonation.RemainingToday(player);
        if (remaining <= 0)
        {
            CommandBuilder.ErrorMessage(connection,
                $"วันนี้บริจาคครบ {GuildDonation.DailyLimit} แต้มแล้ว พรุ่งนี้ค่อยมาใหม่");
            return;
        }

        //Cut the stack down to what today's allowance can take rather than refusing the
        //whole thing: somebody carrying two hundred of something should not have to work
        //out how many will fit.
        var affordable = remaining / per;
        if (affordable <= 0)
        {
            CommandBuilder.ErrorMessage(connection, "เหลือโควต้าวันนี้ไม่พอสำหรับของชิ้นนี้");
            return;
        }

        if (count > affordable)
            count = affordable;

        if (player.Inventory == null
            || !player.Inventory.RemoveItemByBagIdAndGetRemovedItem(bagId, count, out _))
        {
            CommandBuilder.ErrorMessage(connection, "ของไม่พอ");
            return;
        }

        //--- nothing below here may fail ------------------------------------------
        var gained = per * count;
        var before = guild.Level;

        guild.Contribution += gained;
        GuildDonation.RecordDonation(player, gained);

        var after = guild.Level;
        if (after > before)
            guild.SkillPoints += after - before;

        RoDatabase.EnqueueDbRequest(
            new GuildContributionRequest(guild.GuildId, guild.Contribution, guild.SkillPoints));

        CommandBuilder.SendUpdatePlayerData(player, true, false, player.HasCart);

        var itemName = DataManager.GetItemInfoById(item.Id)?.Name ?? "ของ";
        Announce(guild, $"{player.Name} บริจาค {itemName} x{count} ให้กิลด์ (+{gained} แต้ม)");

        if (after > before)
            Announce(guild, $"กิลด์ {guild.GuildName} ขึ้นเป็นเลเวล {after} แล้ว!");
    }

    /// <summary>
    /// The leader spends a point on one of the guild's skills.
    ///
    /// Everyone online is recalculated, not just the leader: the whole point of a guild
    /// skill is that it lands on forty people at once, and a bonus nobody feels until they
    /// relog is a bonus nobody believes in.
    /// </summary>
    private static void LearnSkill(NetworkConnection connection, Player player, GuildSkill skill)
    {
        var guild = player.Guild;
        if (guild == null || !guild.IsLeader(player))
        {
            CommandBuilder.ErrorMessage(connection, "เฉพาะหัวหน้ากิลด์เท่านั้นที่ทำได้");
            return;
        }

        var max = GuildSkills.MaxLevelOf(skill);
        if (max <= 0)
        {
            CommandBuilder.ErrorMessage(connection, "ไม่มีสกิลนั้น");
            return;
        }

        if (guild.SkillPoints <= 0)
        {
            CommandBuilder.ErrorMessage(connection, "ไม่มีแต้มสกิลเหลือ");
            return;
        }

        var index = (int)skill;
        if (guild.SkillLevels[index] >= max)
        {
            CommandBuilder.ErrorMessage(connection, "สกิลนี้เต็มเลเวลแล้ว");
            return;
        }

        guild.SkillLevels[index]++;
        guild.SkillPoints--;

        RoDatabase.EnqueueDbRequest(new GuildSkillRequest(guild.GuildId, guild.SkillPoints,
            guild.PackSkills()));

        var name = "";
        foreach (var info in GuildSkills.All)
        {
            if (info.Skill == skill)
                name = info.Name;
        }

        foreach (var member in guild.Members)
        {
            if (!World.Instance.TryFindPlayerByName(member.Name, out var entity))
                continue;

            var online = entity.Get<Player>();
            online.UpdateStats();
            CommandBuilder.SendGuildData(online);
            CommandBuilder.SendGuildAnnouncement(online,
                $"กิลด์ได้สกิล {name} เลเวล {guild.SkillLevels[index]} แล้ว");
        }
    }

    /// <summary>Tells every member who is online, and refreshes what they are looking at.</summary>
    private static void Announce(Guild guild, string text)
    {
        foreach (var member in guild.Members)
        {
            if (!World.Instance.TryFindPlayerByName(member.Name, out var entity))
                continue;

            var online = entity.Get<Player>();
            CommandBuilder.SendGuildData(online);
            CommandBuilder.SendGuildAnnouncement(online, text);
        }
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
            kicked.UpdateStats(); //without this they keep the guild's stats until something else recalculates
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
        applicant.UpdateStats(); //picks up the guild's skills, and the mark that says they are working
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
