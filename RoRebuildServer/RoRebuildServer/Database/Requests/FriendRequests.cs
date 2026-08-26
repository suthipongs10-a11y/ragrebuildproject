using Microsoft.EntityFrameworkCore;
using RebuildSharedData.Util;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation;
using RoRebuildServer.Simulation.Guilds;
using RoRebuildServer.Simulation.Market;

namespace RoRebuildServer.Database.Requests;

/// <summary>What is known about one name on a list, gathered from wherever it currently lives.</summary>
public struct FriendView
{
    public int EntryId;
    public string Name;
    public int Job;
    public int Level;
    public string GuildName;
    public bool IsOnline;
}

/// <summary>The pieces every friend request needs, written once.</summary>
public static class FriendQueries
{
    /// <summary>
    /// Nobody needs a thousand friends, and the list is sent whole in one packet.
    /// </summary>
    public const int MaxFriends = 60;

    /// <summary>
    /// Fills in a row from the character who is actually standing in the world, and from
    /// the saved character when they are not.
    /// </summary>
    /// <remarks>
    /// Two sources because a friend list is mostly people who are not here. The live
    /// player is the truthful one - somebody who levelled two minutes ago has not been
    /// written to the database yet - so it is asked first and the saved copy is the
    /// fallback rather than the other way round.
    /// </remarks>
    public static FriendView Describe(DbFriend row, DbCharacter? saved)
    {
        var view = new FriendView
        {
            EntryId = row.Id,
            Name = row.FriendName,
            Job = -1,
            Level = 0,
            GuildName = string.Empty,
            IsOnline = false,
        };

        var online = Inbox.FindOnline(row.FriendId, row.FriendName);
        if (online != null)
        {
            view.Name = online.Name;
            view.Job = online.GetData(RebuildSharedData.Enum.EntityStats.PlayerStat.Job);
            view.Level = online.GetData(RebuildSharedData.Enum.EntityStats.PlayerStat.Level);
            view.GuildName = online.Guild != null ? online.Guild.Name : string.Empty;
            view.IsOnline = true;
            return view;
        }

        if (saved == null)
            return view;

        view.Name = saved.Name;

        //The summary is the same block of ints the character picker is drawn from, copied
        //into bytes as it stood: level first, job second. Read rather than unpacked into a
        //whole summary, because two numbers out of twenty is not worth the allocation.
        var summary = saved.CharacterSummary;
        if (summary != null && summary.Length >= (int)PlayerSummaryData.JobId * sizeof(int) + sizeof(int))
        {
            view.Level = BitConverter.ToInt32(summary, (int)PlayerSummaryData.Level * sizeof(int));
            view.Job = BitConverter.ToInt32(summary, (int)PlayerSummaryData.JobId * sizeof(int));
        }

        if (saved.GuildId.HasValue && GuildManager.TryGetGuild(saved.GuildId.Value, out var guild))
            view.GuildName = guild.Name;

        return view;
    }

    /// <summary>Reads one character's whole list and sends it, if they are still here to get it.</summary>
    public static async Task SendList(RoContext dbContext, Guid ownerId, string ownerName)
    {
        var rows = await dbContext.Friends.AsNoTracking()
            .Where(f => f.OwnerId == ownerId)
            .OrderBy(f => f.FriendName)
            .ToListAsync();

        var player = Inbox.FindOnline(ownerId, ownerName);
        if (player == null)
            return;

        var views = await BuildViews(dbContext, rows);
        CommandBuilder.SendFriendList(player, views);
    }

    /// <summary>
    /// Turns rows into what the window shows, in one query rather than one per name.
    /// </summary>
    public static async Task<List<FriendView>> BuildViews(RoContext dbContext, List<DbFriend> rows)
    {
        var views = new List<FriendView>(rows.Count);
        if (rows.Count == 0)
            return views;

        var ids = rows.Select(r => r.FriendId).ToList();
        var saved = await dbContext.Character.AsNoTracking()
            .Where(c => ids.Contains(c.Id))
            .Select(c => new DbCharacter
            {
                Id = c.Id, Name = c.Name, CharacterSummary = c.CharacterSummary, GuildId = c.GuildId
            })
            .ToDictionaryAsync(c => c.Id);

        foreach (var row in rows)
        {
            saved.TryGetValue(row.FriendId, out var character);
            views.Add(Describe(row, character));
        }

        return views;
    }
}

/// <summary>Asks for the whole list, which is what opening the window does.</summary>
public class FriendListRequest : IDbRequest
{
    private readonly Guid ownerId;
    private readonly string ownerName;

    public FriendListRequest(Guid ownerId, string ownerName)
    {
        this.ownerId = ownerId;
        this.ownerName = ownerName;
    }

    public Task ExecuteAsync(RoContext dbContext) => FriendQueries.SendList(dbContext, ownerId, ownerName);
}

/// <summary>
/// Writes one name down.
/// </summary>
/// <remarks>
/// Resolved by name here rather than on the game thread, because the person being
/// remembered does not have to be online - half the point of a list is the people who
/// are not - and only the database knows who a name belongs to when they are away.
/// </remarks>
public class FriendAddRequest : IDbRequest
{
    private readonly Guid ownerId;
    private readonly string ownerName;
    private readonly string targetName;

    public FriendAddRequest(Guid ownerId, string ownerName, string targetName)
    {
        this.ownerId = ownerId;
        this.ownerName = ownerName;
        this.targetName = targetName;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var player = Inbox.FindOnline(ownerId, ownerName);

        var target = await dbContext.Character.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Name == targetName);

        if (target == null)
        {
            Notice(player, $"ไม่พบตัวละครชื่อ {targetName}");
            return;
        }

        if (target.Id == ownerId)
        {
            Notice(player, "จดจำตัวเองไม่ได้");
            return;
        }

        var already = await dbContext.Friends
            .FirstOrDefaultAsync(f => f.OwnerId == ownerId && f.FriendId == target.Id);
        if (already != null)
        {
            //Not an error. Pressing remember on somebody already remembered is somebody
            //checking, and telling them they are already there is the answer to that.
            Notice(player, $"{target.Name} อยู่ในรายชื่อเพื่อนอยู่แล้ว");
            return;
        }

        var count = await dbContext.Friends.CountAsync(f => f.OwnerId == ownerId);
        if (count >= FriendQueries.MaxFriends)
        {
            Notice(player, $"รายชื่อเพื่อนเต็มแล้ว (สูงสุด {FriendQueries.MaxFriends} คน)");
            return;
        }

        dbContext.Friends.Add(new DbFriend
        {
            OwnerId = ownerId,
            FriendId = target.Id,
            FriendName = target.Name,
            AddedAt = DateTime.UtcNow,
        });

        await dbContext.SaveChangesAsync();

        Notice(player, $"จดจำ {target.Name} เป็นเพื่อนแล้ว");
        await FriendQueries.SendList(dbContext, ownerId, ownerName);
    }

    private static void Notice(Player? player, string text)
    {
        if (player != null)
            CommandBuilder.SendFriendNotice(player, text);
    }
}

/// <summary>Takes one name off, by the entry id the list was sent with.</summary>
public class FriendRemoveRequest : IDbRequest
{
    private readonly Guid ownerId;
    private readonly string ownerName;
    private readonly int entryId;

    public FriendRemoveRequest(Guid ownerId, string ownerName, int entryId)
    {
        this.ownerId = ownerId;
        this.ownerName = ownerName;
        this.entryId = entryId;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        //Owner checked as well as id, or an entry id typed by hand would take somebody
        //else's friend off their list.
        var row = await dbContext.Friends
            .FirstOrDefaultAsync(f => f.Id == entryId && f.OwnerId == ownerId);

        var player = Inbox.FindOnline(ownerId, ownerName);
        if (row == null)
        {
            if (player != null)
                CommandBuilder.SendFriendNotice(player, "ไม่พบรายชื่อนี้");
            return;
        }

        var name = row.FriendName;
        dbContext.Friends.Remove(row);
        await dbContext.SaveChangesAsync();

        if (player != null)
            CommandBuilder.SendFriendNotice(player, $"ลบ {name} ออกจากรายชื่อเพื่อนแล้ว");

        await FriendQueries.SendList(dbContext, ownerId, ownerName);
    }
}

/// <summary>
/// Tells everyone who remembers this character that they have come or gone.
/// </summary>
/// <remarks>
/// Searched the other way round from every other read of this table: everybody whose
/// list has this character on it, rather than this character's own list. That is what
/// the index on FriendId would be for - there is only one on OwnerId, because this runs
/// twice per session and the other runs whenever a window opens.
/// </remarks>
public class FriendNotifyPresenceRequest : IDbRequest
{
    private readonly Guid characterId;
    private readonly string characterName;
    private readonly bool isOnline;

    public FriendNotifyPresenceRequest(Guid characterId, string characterName, bool isOnline)
    {
        this.characterId = characterId;
        this.characterName = characterName;
        this.isOnline = isOnline;
    }

    public async Task ExecuteAsync(RoContext dbContext)
    {
        var rows = await dbContext.Friends.AsNoTracking()
            .Where(f => f.FriendId == characterId)
            .ToListAsync();

        if (rows.Count == 0)
            return;

        //Worked out once and sent to everybody, because it is the same character in every
        //one of these rows and the only thing that differs is which list it sits on.
        var job = -1;
        var level = 0;
        var guildName = string.Empty;

        if (isOnline)
        {
            var them = Inbox.FindOnline(characterId, characterName);
            if (them != null)
            {
                job = them.GetData(RebuildSharedData.Enum.EntityStats.PlayerStat.Job);
                level = them.GetData(RebuildSharedData.Enum.EntityStats.PlayerStat.Level);
                guildName = them.Guild != null ? them.Guild.Name : string.Empty;
            }
        }

        foreach (var row in rows)
        {
            var owner = Inbox.FindOnline(row.OwnerId, null);
            if (owner == null)
                continue;

            CommandBuilder.SendFriendStatus(owner, new FriendView
            {
                EntryId = row.Id,
                Name = characterName,
                Job = job,
                Level = level,
                GuildName = guildName,
                IsOnline = isOnline,
            });
        }
    }
}
