using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Data.Monster;
using RoRebuildServer.Data.ServerConfigScript;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Monsters;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Custom;

/// <summary>
/// The things worth the whole server hearing about, said in gold across everyone's
/// chat with the notice sound behind it.
///
/// A private server lives on the moments the rest of the players see. Two of them are
/// worth interrupting people for: somebody taking a piece of gear to the refine level
/// where it could just as easily have shattered, and an MVP going down.
/// </summary>
public class ServerAnnouncements : ServerConfigScriptHandlerBase
{
    /// <summary>Gold, and light enough to read on the dark chat panel.</summary>
    private const string GoldColor = "#FFC83D";

    /// <summary>
    /// The refine level worth announcing. Below this the risk is not really a risk and
    /// the announcement stops meaning anything by being constant.
    /// </summary>
    private const int RefineAnnounceLevel = 10;

    public override void PostServerStartEvent()
    {
        MonsterRewardManager.RegisterKillMonsterEvent(OnKillMonster);
        ServerLogger.Log("Server announcements are enabled.");
    }

    /// <summary>
    /// Sends one line to every player on the server, twice over: once as an announcement
    /// event, which the client puts across the top of the screen for a few seconds, and
    /// once into the chat log so it is still there to read afterwards.
    ///
    /// The empty name on the chat copy is what tells the client to print the text on its
    /// own rather than prefixing it with a speaker, and the flag at the end is what plays
    /// the notice sound.
    /// </summary>
    public static void Announce(string text)
    {
        var line = $"<color={GoldColor}>{text}</color>";

        CommandBuilder.AddAllPlayersAsRecipients();
        CommandBuilder.SendServerEventMulti(ServerEvent.Announcement, 0, line);
        CommandBuilder.SendServerMessage(line, "", true);
        CommandBuilder.ClearRecipients();
    }

    private void OnKillMonster(Monster monster)
    {
        var character = monster.Character;
        if (character.DisplayType != CharacterDisplayType.Mvp)
            return;

        var map = character.Map?.Name ?? "somewhere";
        Announce($"★ {character.Name} has been defeated on {map}!");
    }

    /// <summary>
    /// Called from the refine handler once a refine has actually gone through, since
    /// only that code knows whether the attempt succeeded and what it landed on.
    /// </summary>
    public static void AnnounceRefine(Player player, int itemId, int refineLevel)
    {
        if (refineLevel < RefineAnnounceLevel)
            return;

        var name = DataManager.GetItemInfoById(itemId)?.Name ?? "a piece of equipment";
        Announce($"★ {player.Name} has refined {name} to +{refineLevel}!");
    }
}
