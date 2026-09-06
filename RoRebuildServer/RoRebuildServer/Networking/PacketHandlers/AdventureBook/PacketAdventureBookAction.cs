using System.Diagnostics;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using RoRebuildServer.Custom.AdventureBook;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Util;

//Namespaced one level up rather than matching the folder, deliberately. A namespace called
//AdventureBook sitting beside a class called AdventureBook means the simple name resolves to
//the namespace and every use of the class has to be spelled out in full - and the error when
//somebody forgets names a namespace nobody typed.
namespace RoRebuildServer.Networking.PacketHandlers;

/// <summary>
/// The two things the adventure book window asks for, behind one packet with an action byte.
/// </summary>
/// <remarks>
/// The travel request is checked here in full and takes nothing the client says on trust: the
/// client names a monster and a map, and both the right to go and the fact that the monster is
/// even there are worked out from the server's own copy of the book.
///
/// It deliberately does not reuse AdminRequestMove. That packet is gated on being an admin or
/// on EnableWarpCommandForEveryone, and borrowing it would mean either handing every player a
/// GM command or leaving that setting on - which lets anybody go anywhere without the star
/// the book asks for, and makes the book, the kafra and both wing items pointless at once.
///
/// The road is free. For a while it charged a fare below rank five, roughly what the kafra
/// charges, and the fare bought nothing but a reason not to open the book: the star is the
/// price of the trip, and it is paid in the field.
/// </remarks>
[ClientPacketHandler(PacketType.AdventureBookAction)]
public class PacketAdventureBookAction : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame)
            return;

        Debug.Assert(connection.Player != null);
        var player = connection.Player;
        var action = (AdventureBookRequestType)msg.ReadByte();

        //The boss log rides in the same window and on the same packet, so a refresh is served
        //when either of the two is switched on. Everything below the refresh needs the book
        //itself, and says so where it needs it.
        var hasBook = AdventureBookManager.IsEnabled && AdventureBook.IsBuilt;
        var hasBossLog = Custom.BossLog.BossLogManager.IsEnabled && Custom.BossLog.BossLog.IsBuilt;
        if (!hasBook && !hasBossLog)
            return;

        switch (action)
        {
            case AdventureBookRequestType.Refresh:
                if (hasBook)
                {
                    //Before anything is read, so a character whose pages were renamed by a
                    //content update sees the progress they have rather than an empty book.
                    AdventureBookProgress.EnsureMigrated(player);
                    CommandBuilder.SendAdventureBook(player);
                }

                CommandBuilder.SendBossLog(player);
                break;

            case AdventureBookRequestType.Warp:
                if (hasBook)
                    Warp(connection, player, msg.ReadInt32(), msg.ReadString());
                break;
        }
    }

    private static void Warp(NetworkConnection connection, Player player, int pageId, string mapName)
    {
        if (!AdventureBook.EntriesByPageId.TryGetValue(pageId, out var entry))
        {
            Deny(player, AdventureBookWarpDenial.Unknown);
            return;
        }

        if (!AdventureBookProgress.HasStar(player, entry, AdventureBookStars.Hunt))
        {
            Deny(player, AdventureBookWarpDenial.NoStar);
            return;
        }

        //Asked of the book rather than of the world: the client sends a map name, and without
        //this it could send any name at all and be taken there for the price of a Creamy.
        var stands = false;
        foreach (var sighting in entry.Sightings)
        {
            if (!string.Equals(sighting.Map, mapName, StringComparison.OrdinalIgnoreCase))
                continue;
            stands = true;
            break;
        }

        if (!stands)
        {
            Deny(player, AdventureBookWarpDenial.NotThere);
            return;
        }

        var character = connection.Character;
        if (character?.Map == null || !character.Map.World.TryGetWorldMapByName(mapName, out var map))
        {
            CommandBuilder.SendRequestFailed(player, ClientErrorType.UnknownMap);
            return;
        }

        if (player.InInputActionCooldown())
        {
            CommandBuilder.SendRequestFailed(player, ClientErrorType.TooManyRequests);
            return;
        }

        if (player.IsInNpcInteraction)
            return;

        var pos = map.WalkData.FindWalkableCellOnMap();

        player.AddInputActionDelay(InputActionCooldownType.Teleport);
        character.ResetState();
        character.SetSpawnImmunity();
        player.CombatEntity.ClearDamageQueue();

        if (character.Map.Name == mapName)
        {
            character.CombatEntity.RemoveStatusOfGroupIfExists("StopGroup");
            character.Map.TeleportEntity(ref connection.Entity, character, pos, CharacterRemovalReason.OutOfSight);
        }
        else
            player.WarpPlayer(mapName, pos.X, pos.Y, 1, 1, false);
    }

    private static void Deny(Player player, AdventureBookWarpDenial reason)
    {
        var text = reason switch
        {
            AdventureBookWarpDenial.NoStar => "ยังเดินทางไปหามอนตัวนี้ไม่ได้ ต้องได้ ★ แรกของมันก่อน",
            AdventureBookWarpDenial.NotThere => "มอนตัวนี้ไม่ได้อยู่บนแมพนั้น",
            _ => "ไม่พบมอนตัวนี้ในสมุดผจญภัย"
        };

        CommandBuilder.SendServerMessageTo(player, text);
    }
}
