using RoRebuildServer.Database.Domain;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Simulation.Guilds;

public class GuildMember
{
    public Guid CharacterId;
    public string Name = "";

    /// <summary>
    /// Last known job and level, which is all that can honestly be offered.
    ///
    /// Membership is stored by character id and name because a member can be offline, and
    /// a character's job and level live inside a serialized blob on their row rather than
    /// in columns a query can reach. So these are filled in whenever the member is seen
    /// online and remembered afterwards; a member who has not been on since the server
    /// started reads as unknown rather than as level zero.
    /// </summary>
    public int Job = -1;
    public int Level = -1;
    public bool HasDetails => Level >= 0;
}

/// <summary>
/// Somebody asking to be let in. Kept in memory only: a request is answered in the same
/// sitting or it is not worth answering, and persisting it would mean a table and a
/// migration for something with the lifetime of a conversation.
/// </summary>
public class GuildJoinRequest
{
    public Guid CharacterId;
    public string Name = "";
}

/// <summary>
/// A guild is a persistent named group of characters. Unlike a party it survives
/// logout, so the member list is kept by character id and name rather than by live
/// entity, and online members are resolved by name lookup when a message is sent.
/// Guild war is deliberately out of scope, this is membership only.
/// </summary>
public class Guild
{
    public const int MaxMembers = 40;
    public const int MaxNameLength = 24;

    /// <summary>How many people may be waiting to be let in at once.</summary>
    public const int MaxPendingRequests = 20;

    public int GuildId;
    public string GuildName;
    public Guid LeaderId;
    public readonly List<GuildMember> Members = new();
    public readonly List<GuildJoinRequest> JoinRequests = new();

    public bool IsFull => Members.Count >= MaxMembers;

    public Guild(int guildId, string guildName, Guid leaderId)
    {
        GuildId = guildId;
        GuildName = guildName;
        LeaderId = leaderId;
    }

    public Guild(DbGuild db) : this(db.Id, db.GuildName, db.LeaderId) { }

    public bool IsLeader(Player player) => player.Id == LeaderId;

    public bool HasMember(Guid id)
    {
        foreach (var member in Members)
        {
            if (member.CharacterId == id)
                return true;
        }

        return false;
    }

    public void AddMember(Guid id, string name)
    {
        if (HasMember(id))
            return;
        Members.Add(new GuildMember { CharacterId = id, Name = name });
    }

    public GuildMember? FindMember(Guid id)
    {
        foreach (var member in Members)
        {
            if (member.CharacterId == id)
                return member;
        }

        return null;
    }

    public GuildMember? FindMemberByName(string name)
    {
        foreach (var member in Members)
        {
            if (string.Equals(member.Name, name, StringComparison.OrdinalIgnoreCase))
                return member;
        }

        return null;
    }

    /// <summary>
    /// Writes down what a member is, so the roster can say something about them after they
    /// log out. Called wherever a member is known to be online and current.
    /// </summary>
    public void UpdateMemberDetails(Guid id, int job, int level)
    {
        var member = FindMember(id);
        if (member == null)
            return;

        member.Job = job;
        member.Level = level;
    }

    public bool HasJoinRequest(Guid id)
    {
        foreach (var request in JoinRequests)
        {
            if (request.CharacterId == id)
                return true;
        }

        return false;
    }

    /// <summary>Returns false when the queue is full or the request is already in it.</summary>
    public bool AddJoinRequest(Guid id, string name)
    {
        if (HasJoinRequest(id) || HasMember(id) || JoinRequests.Count >= MaxPendingRequests)
            return false;

        JoinRequests.Add(new GuildJoinRequest { CharacterId = id, Name = name });
        return true;
    }

    public bool RemoveJoinRequest(Guid id)
    {
        for (var i = JoinRequests.Count - 1; i >= 0; i--)
        {
            if (JoinRequests[i].CharacterId != id)
                continue;

            JoinRequests.RemoveAt(i);
            return true;
        }

        return false;
    }

    public void RemoveMember(Guid id)
    {
        for (var i = Members.Count - 1; i >= 0; i--)
        {
            if (Members[i].CharacterId == id)
                Members.RemoveAt(i);
        }
    }

    /// <summary>
    /// Sends a server message to every member currently logged in. Members are stored
    /// by name because they can be offline, so online ones are found by name lookup.
    /// </summary>
    public void Announce(string text)
    {
        var hasRecipient = false;

        foreach (var member in Members)
        {
            if (!World.Instance.TryFindPlayerByName(member.Name, out var entity))
                continue;

            CommandBuilder.AddRecipient(entity);
            hasRecipient = true;
        }

        if (hasRecipient)
            CommandBuilder.SendServerMessage(text);
        CommandBuilder.ClearRecipients();
    }
}

/// <summary>
/// The wait between walking out of a guild and being allowed into another one.
///
/// Without it a guild is not a commitment: you can leave the moment a better offer turns
/// up and be in the other one before anybody notices. A day is long enough that leaving
/// is a decision and short enough that a mistake is not permanent.
///
/// It follows the character rather than the guild, and it is only ever set by leaving of
/// your own accord. Being thrown out was not your choice, and making the person who was
/// kicked wait a day would hand every leader a way to bench somebody.
/// </summary>
public static class GuildCooldown
{
    /// <summary>
    /// Kept in the same per-character store the NPC scripts use, which already survives
    /// logout and already goes to the database, rather than in a table of its own for a
    /// single number.
    /// </summary>
    public const string Flag = "GuildLeaveTime";

    public const int Seconds = 24 * 60 * 60;

    private static int Now => (int)DateTimeOffset.UtcNow.ToUnixTimeSeconds();

    public static void StartFor(Player player) => player.SetNpcFlag(Flag, Now);

    /// <summary>Zero once the wait is over, which is also what it reads for anyone who never left one.</summary>
    public static int SecondsRemaining(Player player)
    {
        var left = player.GetNpcFlag(Flag);
        if (left <= 0)
            return 0;

        var remaining = left + Seconds - Now;
        return remaining > 0 ? remaining : 0;
    }

    /// <summary>"อีก 5 ชั่วโมง 12 นาที", for saying no with a reason attached.</summary>
    public static string Describe(int seconds)
    {
        var hours = seconds / 3600;
        var minutes = seconds % 3600 / 60;

        if (hours > 0)
            return $"อีก {hours} ชั่วโมง {minutes} นาที";
        return minutes > 0 ? $"อีก {minutes} นาที" : "อีกไม่ถึงหนึ่งนาที";
    }
}

/// <summary>
/// Holds every guild that has been loaded this session. Guilds are added when one is
/// created and when a member logs in, so a guild whose members are all offline simply
/// isn't in memory until one of them returns.
/// </summary>
public static class GuildManager
{
    private static readonly Dictionary<int, Guild> LoadedGuilds = new();
    private static readonly object SyncRoot = new();

    public static bool TryGetGuild(int guildId, out Guild guild)
    {
        lock (SyncRoot)
        {
            if (LoadedGuilds.TryGetValue(guildId, out var found))
            {
                guild = found;
                return true;
            }
        }

        guild = null!;
        return false;
    }

    /// <summary>
    /// Registers a guild, returning whichever instance ends up in the cache. A second
    /// caller racing to load the same guild gets the copy that was already stored.
    /// </summary>
    public static Guild Register(Guild guild)
    {
        lock (SyncRoot)
        {
            if (LoadedGuilds.TryGetValue(guild.GuildId, out var existing))
                return existing;

            LoadedGuilds.Add(guild.GuildId, guild);
            return guild;
        }
    }

    public static void Remove(int guildId)
    {
        lock (SyncRoot)
            LoadedGuilds.Remove(guildId);
    }

    /// <summary>
    /// Every guild currently in memory, for the browse list.
    ///
    /// Which is not every guild that exists — one whose members are all offline was never
    /// loaded. That is a real limit of the list and not a bug to be surprised by later: a
    /// guild you cannot see has nobody online to answer you anyway.
    /// </summary>
    public static List<Guild> AllLoadedGuilds()
    {
        lock (SyncRoot)
            return new List<Guild>(LoadedGuilds.Values);
    }
}
