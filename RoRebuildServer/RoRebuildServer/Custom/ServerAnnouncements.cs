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
/// A private server lives on the moments the rest of the players see, and there are
/// exactly three: a card found, a piece of gear taken to the refine level where it could
/// as easily have shattered, and an MVP going down. Three is the point — a fourth would
/// start the slide to nobody reading any of them.
///
/// Written in Thai, like the rest of the interface. These are read at a glance in the
/// middle of a fight, which is the one place a language you have to translate in your head
/// costs you something.
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

        //Who did it, not just what died. The top damage contributor is the same person the
        //drops are reserved for, so it is the same answer the rest of the kill already uses.
        var killer = monster.GetTopContributor();
        if (killer != null && killer.Type == CharacterType.Player)
            Announce($"เทพมาแล้ว {killer.Name} กำจัด {character.Name} ได้รับ MVP !");
        else
            Announce($"{character.Name} ถูกกำจัดแล้ว !");
    }

    /// <summary>
    /// Called as a card is picked up off the ground.
    ///
    /// Cards are the one drop in the game everybody wants and almost nobody sees, so who
    /// got which one is the news of the evening on a server this size. Said at the pickup
    /// rather than at the drop, because the drop is not yet anybody's.
    /// </summary>
    public static void AnnounceCardFound(Player player, int itemId)
    {
        var info = DataManager.GetItemInfoById(itemId);
        if (info == null || info.ItemClass != ItemClass.Card)
            return;

        Announce($"{player.Name} ได้รับ {info.Name} !");
    }

    /// <summary>
    /// Called from the refine handler once a refine has actually gone through, since
    /// only that code knows whether the attempt succeeded and what it landed on.
    /// </summary>
    public static void AnnounceRefine(Player player, int itemId, int refineLevel)
    {
        if (refineLevel < RefineAnnounceLevel)
            return;

        var name = DataManager.GetItemInfoById(itemId)?.Name ?? "อุปกรณ์";
        Announce($"สุดยอด {player.Name} ตีบวก +{refineLevel} {name} ได้สำเร็จ !");
    }
}
