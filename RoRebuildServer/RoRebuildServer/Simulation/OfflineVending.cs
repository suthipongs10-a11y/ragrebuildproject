using System.Collections.Concurrent;
using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntitySystem;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Simulation;

/// <summary>
/// Shops that keep selling after the person running them has closed the game.
/// </summary>
/// <remarks>
/// A vending shop is not a thing the server stores - it is a live player standing on a
/// tile with a proxy npc on top of them, holding the goods in their cart. Every part of
/// buying from one reads the seller: their cart, their zeny, their interaction state. So
/// leaving a shop open after the seller has gone means leaving the seller in the world.
/// That is what this does. The connection is unhooked from the socket, taken out of the
/// list the server sends packets to, and kept here with the character still standing on
/// the map. Anything the server would have told the seller is dropped on the way out,
/// which the send loop already does for a closed socket.
///
/// Nothing is written to the database beyond the ordinary character save, and that is on
/// purpose: a shop is a thing in a running world, not a record. If the server restarts,
/// the shops are gone and everybody's goods are back in their cart, because the buy
/// handler writes both sides to the database the moment a sale completes.
///
/// The account slot stays taken for as long as the shop stands. It has to: the character
/// is already in the world, and letting the account back in would load a second copy of
/// it - the same cart, the same zeny, in two places at once. Logging in instead asks the
/// shop to close and says to try again in a moment, which is the same handshake the
/// server already uses for a connection that has not finished going away.
/// </remarks>
public static class OfflineVending
{
    /// <summary>Keyed by account, because that is what a login collides on.</summary>
    private static readonly ConcurrentDictionary<int, NetworkConnection> shops = new();

    public static int Count => shops.Count;

    /// <summary>Whether the server is willing to hold shops open at all.</summary>
    public static bool IsEnabled => ServerConfig.OperationConfig.OfflineVendingHours > 0;

    public static double ShopDuration => ServerConfig.OperationConfig.OfflineVendingHours * 3600.0;

    /// <summary>
    /// Whether this player is standing in a shop right now, offline or otherwise.
    /// </summary>
    /// <remarks>
    /// All four conditions, because each of them ends a shop on its own: the proxy npc
    /// expires when the owner walks away or dies, the interaction ends when the last item
    /// sells, and the vending state is cleared when the shop is closed by hand.
    /// </remarks>
    public static bool IsVending(Player? player)
    {
        if (player == null || player.VendingState == null)
            return false;

        if (!player.VendingState.VendProxy.IsAlive())
            return false;

        return player.IsInNpcInteraction
               && player.NpcInteractionState.InteractionResult == NpcInteractionResult.CurrentlyVending;
    }

    /// <summary>
    /// Takes a disconnecting connection over, leaving its character in the world.
    /// Returns false if this one is not eligible, in which case it disconnects normally.
    /// </summary>
    /// <remarks>
    /// Called from DisconnectPlayer, which is the one place a player leaves the world, so
    /// there is no path that quietly skips this - and no path that runs it twice, since
    /// the connection is out of the player list by the time this returns.
    /// </remarks>
    public static bool TryTakeOver(NetworkConnection connection)
    {
        //Already holding this one. A disconnect can be queued for the same connection more
        //than once - the server can remove a player at the same moment the connection asks
        //to be removed - and a second pass through here must not take the character out
        //from under the shop the first pass left standing.
        if (shops.TryGetValue(connection.AccountId, out var held) && held == connection)
            return true;

        if (!connection.IsOfflineVending)
            return false;

        connection.IsOfflineVending = false; //re-armed below only if everything checks out

        if (!IsEnabled || !connection.Entity.IsAlive() || !IsVending(connection.Player))
        {
            //The socket loop leaves the account slot taken as soon as the request is read
            //off the wire, and it runs before this does. So turning the request down means
            //handing the slot back by hand - otherwise an asking-for-nothing request locks
            //its own account out of the server until a restart.
            NetworkManager.ReleaseAccount(connection);
            return false;
        }

        var player = connection.Player!;

        //Written down before the shop starts standing on its own. Every sale saves the
        //seller again, so this is only the state at the moment of walking away - but if
        //the server is stopped hard, that is the state to come back to.
        player.WriteCharacterToDatabase();

        if (!shops.TryAdd(connection.AccountId, connection))
        {
            ServerLogger.LogWarning($"Account {connection.AccountId} already has an offline shop registered, " +
                                    $"so {player.Name}'s shop is being closed instead of held open.");
            NetworkManager.ReleaseAccount(connection);
            return false;
        }

        connection.IsOfflineVending = true;
        connection.OfflineVendingUntil = Time.ElapsedTime + ShopDuration;

        ServerLogger.Log($"[OfflineVending] {player.Name} left a shop standing on " +
                         $"{player.Character.Map?.Name ?? "?"}. {shops.Count} shop(s) open.");

        return true;
    }

    /// <summary>
    /// Asks the shop belonging to this account to close on the next tick, if it has one.
    /// </summary>
    /// <remarks>
    /// A request rather than a close, because this is called from the login path, which
    /// runs on a request thread. Taking a character out of the world is a main thread job
    /// - World says so at the top of FullyRemoveEntity - so all this does is set a flag
    /// and let Update do the work between two server frames.
    /// </remarks>
    public static bool RequestClose(int accountId)
    {
        if (!shops.TryGetValue(accountId, out var connection))
            return false;

        connection.OfflineVendingCloseRequested = true;
        return true;
    }

    /// <summary>
    /// Closes every shop still standing. For a server that is shutting down.
    /// </summary>
    public static void CloseAll()
    {
        foreach (var pair in shops)
            Close(pair.Value, "the server is shutting down");
    }

    /// <summary>
    /// Ends the shops that are out of time, sold out, or wanted gone.
    /// </summary>
    /// <remarks>
    /// Driven from World.Update rather than from anything a player does, because the
    /// whole point of these is that there is nobody there to drive them.
    /// </remarks>
    public static void Update()
    {
        if (shops.IsEmpty)
            return;

        foreach (var pair in shops)
        {
            var connection = pair.Value;

            if (connection.OfflineVendingCloseRequested)
            {
                Close(connection, "the owner is logging back in");
                continue;
            }

            if (!connection.Entity.IsAlive())
            {
                //Whatever took the character out of the world did not come through here.
                //Nothing to close, but the account slot is still ours to give back.
                Forget(connection);
                continue;
            }

            if (!IsVending(connection.Player))
            {
                Close(connection, "the shop is no longer running");
                continue;
            }

            if (Time.ElapsedTime > connection.OfflineVendingUntil)
                Close(connection, "the shop ran out of time");
        }
    }

    private static void Close(NetworkConnection connection, string reason)
    {
        var name = connection.Player?.Name ?? "[unknown]";

        //The proxy first. It is the sign in the world and the thing other players click,
        //and taking the character out from under it would leave it hanging for however
        //long the npc's own timer takes to notice its owner has gone.
        var vending = connection.Player?.VendingState;
        if (vending != null)
        {
            if (vending.VendProxy.TryGet<Npc>(out var npc))
                npc.EndEvent();

            vending.VendProxy = Entity.Null;
        }

        if (connection.Entity.IsAlive())
        {
            //Saves the character on the way out, the same as any other player leaving.
            World.Instance.FullyRemoveEntity(ref connection.Entity, CharacterRemovalReason.Disconnect);
            connection.IsAlive = false;
        }

        Forget(connection);

        ServerLogger.Log($"[OfflineVending] {name}'s shop has closed because {reason}. " +
                         $"{shops.Count} shop(s) open.");
    }

    /// <summary>Gives the account back, which is what lets its owner log in again.</summary>
    private static void Forget(NetworkConnection connection)
    {
        connection.IsOfflineVending = false;
        connection.OfflineVendingCloseRequested = false;
        shops.TryRemove(connection.AccountId, out _);
        NetworkManager.ReleaseAccount(connection);
    }
}
