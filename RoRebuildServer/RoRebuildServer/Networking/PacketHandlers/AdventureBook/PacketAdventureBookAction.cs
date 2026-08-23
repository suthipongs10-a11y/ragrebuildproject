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
/// GM command or leaving that setting on - which would make the kafra's fee, both wing items
/// and this whole feature pointless at the same time.
/// </remarks>
[ClientPacketHandler(PacketType.AdventureBookAction)]
public class PacketAdventureBookAction : IClientPacketHandler
{
    /// <summary>The rank at which the road is free. Below it the book charges a fare.</summary>
    private const int FreeTravelRank = 5;

    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame)
            return;

        Debug.Assert(connection.Player != null);
        var player = connection.Player;
        var action = (AdventureBookRequestType)msg.ReadByte();

        if (!AdventureBookManager.IsEnabled || !AdventureBook.IsBuilt)
            return;

        switch (action)
        {
            case AdventureBookRequestType.Refresh:
                CommandBuilder.SendAdventureBook(player);
                break;

            case AdventureBookRequestType.Warp:
                Warp(connection, player, msg.ReadInt32(), msg.ReadString());
                break;
        }
    }

    /// <summary>The fare, by how dangerous the thing at the other end is.</summary>
    /// <remarks>Roughly what the kafra charges, so neither road makes the other pointless.</remarks>
    public static int FareFor(int monsterLevel) => Math.Clamp(500 + monsterLevel * 10, 500, 2000);

    private static void Warp(NetworkConnection connection, Player player, int monsterId, string mapName)
    {
        if (!AdventureBook.EntriesByMonsterId.TryGetValue(monsterId, out var entry))
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

        var fare = AdventureBookProgress.GetRank(player) >= FreeTravelRank ? 0 : FareFor(entry.Level);
        if (fare > 0 && player.GetZeny() < fare)
        {
            Deny(player, AdventureBookWarpDenial.NoZeny);
            return;
        }

        var pos = map.WalkData.FindWalkableCellOnMap();

        //Charged only once everything else has passed, so a refused trip is never a paid one.
        if (fare > 0)
            player.DropZeny(fare);

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

        if (fare > 0)
            CommandBuilder.SendServerMessageTo(player, $"<color=#66FFAA>สมุดผจญภัย: เดินทางไป {mapName} จ่าย {fare:N0} Zeny</color>");
    }

    private static void Deny(Player player, AdventureBookWarpDenial reason)
    {
        var text = reason switch
        {
            AdventureBookWarpDenial.NoStar => "ยังเดินทางไปหามอนตัวนี้ไม่ได้ ต้องได้ ★ แรกของมันก่อน",
            AdventureBookWarpDenial.NoZeny => "Zeny ไม่พอค่าเดินทาง",
            AdventureBookWarpDenial.NotThere => "มอนตัวนี้ไม่ได้อยู่บนแมพนั้น",
            _ => "ไม่พบมอนตัวนี้ในสมุดผจญภัย"
        };

        CommandBuilder.SendServerMessageTo(player, text);
    }
}
