using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents.Util;
using RoRebuildServer.Logging;
using RoRebuildServer.Simulation.Util;
using System.Diagnostics;

namespace RoRebuildServer.Networking.PacketHandlers.Admin;

//NOTE! This is a regular client packet handler rather than an admin one
[ClientPacketHandler(PacketType.AdminRequestMove)]
public class PacketAdminRequestMove : IClientPacketHandler
{
    /// <summary>How long a player waits between one trip out of the database and the next.</summary>
    private const float MapWarpCooldownTime = 30f;

    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsPlayerAlive)
            return;

        Debug.Assert(connection.Player != null);
        Debug.Assert(connection.Character != null);
        Debug.Assert(connection.Character.Map != null);

        if (!connection.Player.CanPerformCharacterActions())
            return;

        var player = connection.Player;
        var ce = player.CombatEntity;
        var ch = connection.Character;

        var mapName = msg.ReadString();
        var posX = msg.ReadInt16();
        var posY = msg.ReadInt16();
        var force = msg.ReadBoolean();

        //Everybody may travel from the database window; what separates a player from an
        //admin is the wait, and the wait is kept here rather than in the window that sends
        //this because a window is the half of the game a player can edit.
        //
        //The wait is the whole rule, so do not turn this into an admin-only packet: the
        //database's map pages are meant to work for players and they come through here. What
        //was removed instead is the bottom bar's tile for the admin warp list, which is a
        //button per map in the game and made this the fastest way anywhere. One trip every
        //half minute, found by looking the map up, is the shape that was wanted.
        var isAdmin = connection.IsAdmin || ServerConfig.DebugConfig.EnableWarpCommandForEveryone;
        if (!isAdmin)
        {
            if (player.MapWarpCooldown > Time.ElapsedTimeFloat)
            {
                CommandBuilder.SendRequestFailed(player, ClientErrorType.TooManyRequests);
                return;
            }

            //An admin tool: it drops the character on the named cell whether or not anything
            //can stand there, clamped only to the map's own edges.
            force = false;
        }

        ServerLogger.Log($"Player {connection.Player.Name} requested move to map {mapName}.");

        if (!ch.Map.World.TryGetWorldMapByName(mapName, out var map))
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

        player.AddInputActionDelay(InputActionCooldownType.Teleport);
        ch.ResetState();
        ch.SetSpawnImmunity();

        ce.ClearDamageQueue();
        //ce.Stats.Hp = ce.Stats.MaxHp;

        var pos = new Position(posX, posY);
        if (!force)
        {
            if (pos.IsValid())
            {
                if (!map.WalkData.IsPositionInBounds(pos) || !map.WalkData.IsCellWalkable(pos))
                {
                    CommandBuilder.SendRequestFailed(player, ClientErrorType.InvalidCoordinates);
                    return;
                }
            }
            else
                pos = map.WalkData.FindWalkableCellOnMap(); //find a random cell if one wasn't requested
        }
        else
        {
            pos.ClampToArea(map.MapBounds.Shrink(4, 4));
        }

        //CommandBuilder.SendHealSingle(player, 0, HealType.None); //heal amount is 0, but we set hp to max so it will update without the effect

        if (!isAdmin)
            player.MapWarpCooldown = Time.ElapsedTimeFloat + MapWarpCooldownTime;

        if (ch.Map.Name == mapName)
        {
            ch.CombatEntity.RemoveStatusOfGroupIfExists("StopGroup");
            ch.Map.TeleportEntity(ref connection.Entity, ch, pos, CharacterRemovalReason.OutOfSight);
        }
        else
            player.WarpPlayer(mapName, pos.X, pos.Y, 1, 1, false);
        //ch.Map.World.MovePlayerMap(ref connection.Entity, ch, map, pos);
    }
}