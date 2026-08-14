using RoRebuildServer.Database.Domain;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Simulation.Guilds;

public class GuildMember
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
    public const int MaxMembers = 32;
    public const int MaxNameLength = 24;

    public int GuildId;
    public string GuildName;
    public Guid LeaderId;
    public readonly List<GuildMember> Members = new();

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
}
