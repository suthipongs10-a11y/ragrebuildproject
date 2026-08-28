using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.Data.Monster;
using RoRebuildServer.Data.ServerConfigScript;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Monsters;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Items;

namespace RoRebuildServer.Custom;

/// <summary>
/// The things worth the whole server hearing about, said in gold across everyone's
/// chat with the notice sound behind it.
///
/// A private server lives on the moments the rest of the players see, and there are
/// exactly three: a card turning up, a piece of gear taken to the refine level where it
/// could as easily have shattered, and an MVP going down. Three is the point — a fourth
/// would start the slide to nobody reading any of them.
///
/// A card has two ways of turning up - off the ground where a monster died, or out of a
/// monster's pocket with Steal - and both say so in the same gold. That is one kind of
/// news told two ways, not two kinds.
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

    /// <summary>
    /// The same line to everybody, but only into the chat log.
    /// </summary>
    /// <remarks>
    /// For news worth telling that is not worth stopping anybody for. The banner across the
    /// top is loud on purpose and stops being news if it fires every few minutes; the chat
    /// copy still reaches every player and is still there to scroll back to.
    /// </remarks>
    public static void AnnounceToChat(string text)
    {
        var line = $"<color={GoldColor}>{text}</color>";

        CommandBuilder.AddAllPlayersAsRecipients();
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
    ///
    /// Only for a card a monster died to leave behind. Announcing whatever was picked up
    /// meant a player could throw a card on the floor and take it back to put the line
    /// across every screen on the server, as often as they liked, which is a toy for
    /// whoever finds it first and noise for everybody else.
    /// </summary>
    public static void AnnounceCardFound(WorldObject picker, ref GroundItem item)
    {
        if (item.DropSourceMonsterId <= 0 || picker.Player == null)
            return;

        var itemId = item.Type == ItemType.UniqueItem ? item.UniqueItem.Id : item.Item.Id;
        var info = DataManager.GetItemInfoById(itemId);
        if (info == null || info.ItemClass != ItemClass.Card)
            return;

        if (!DataManager.MonsterIdLookup.TryGetValue(item.DropSourceMonsterId, out var source))
            return;

        var count = item.Type == ItemType.UniqueItem ? 1 : item.Item.Count;
        var odds = FormatDropChance(source.Code, itemId);

        //The contributor is who the drop was held for, which is who actually made the kill.
        //Somebody else bending down for it after the hold expires still gets their name in
        //gold, but not credit for a kill that was not theirs.
        if (item.ContributorId == picker.Id)
            Announce($"{picker.Name} กำจัด {source.Name} ได้รับ {info.Name} x {count}{odds}");
        else
            Announce($"{picker.Name} ได้รับ {info.Name} x {count} จาก {source.Name}{odds}");
    }

    /// <summary>
    /// The odds the server actually rolls this drop on, ready to append to a line.
    /// </summary>
    /// <remarks>
    /// Read out of the loaded drop table rather than the csv, so it is the number after
    /// DropRateRemapping and any config script have had their say - which is the number that
    /// was really rolled. Deliberately not adjusted by the finder's own drop rate bonus: the
    /// line goes to the whole server, and a figure that changed depending on who was reading
    /// it would be worse than no figure at all.
    ///
    /// Chances are held per ten thousand, so a card at 10 is one tenth of one percent.
    /// </remarks>
    /// <summary>
    /// Called as a card is taken with Steal, which is the other way one arrives.
    /// </summary>
    /// <remarks>
    /// Said at the theft rather than at a pickup, because a stolen card goes straight into
    /// the bag and never touches the ground - there is no pickup to hang it on.
    ///
    /// No odds on the end, unlike the drop line. What the thief's chance actually was
    /// depends on their Steal level and on the gap in DEX between them and what they
    /// robbed, so the only available figure is one that would differ for every reader -
    /// which is the same reason the drop line refuses to adjust for the finder's own drop
    /// bonus.
    ///
    /// Nothing here can be made to repeat: Process puts StolenFrom on the monster and
    /// ValidateTarget refuses a second attempt, so one monster is one line at most, ever.
    /// </remarks>
    public static void AnnounceCardStolen(WorldObject thief, int itemId, int count, MonsterDatabaseInfo source)
    {
        var info = DataManager.GetItemInfoById(itemId);
        if (info == null || info.ItemClass != ItemClass.Card)
            return;

        Announce($"{thief.Name} ได้รับ {info.Name} {count} ea จากการ Steal {source.Name}");
    }

    private static string FormatDropChance(string monsterCode, int itemId)
    {
        if (!DataManager.MonsterDropData.TryGetValue(monsterCode, out var drops))
            return string.Empty;

        foreach (var drop in drops.DropChances)
        {
            if (drop.Id != itemId)
                continue;

            return $" (โอกาสดรอป {(drop.Chance / 100d).ToString("0.##")}%)";
        }

        return string.Empty;
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
