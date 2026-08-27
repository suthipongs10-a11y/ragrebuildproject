using System.Net.WebSockets;
using RebuildSharedData.Enum;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntitySystem;

namespace RoRebuildServer.Networking;

public enum ConnectionStatus
{
    PendingAuthentication,
    Connected,
    Disconnected,
}

public enum ActiveDbAction
{
    None,
    CreateParty
}

public class NetworkConnection
{
    public WebSocket Socket { get; set; }
    public ConnectionStatus Status { get; set; }
    public Entity Entity;
    public WorldObject? Character { get; set; }
    public Player? Player { get; set; }
    public int AccountId { get; set; }
    public string AccountName { get; set; }
    public float LoginTime { get; set; }
    public double LastKeepAlive { get; set; }
    public bool Confirmed { get; set; } = false;
    public CancellationToken Cancellation { get; set; }
    public CancellationTokenSource CancellationSource { get; set; }
    public LoadCharacterRequest? LoadCharacterRequest { get; set; }
    public StorageLoadRequest? LoadStorageRequest { get; set; }
    public CreatePartyRequest? CreatePartyRequest { get; set; }
    public ActiveDbAction ActiveDbAction { get; set; }

    /// <summary>
    /// Set while this connection's character is left standing in the world as a shop with
    /// nobody at the keyboard. See Simulation.OfflineVending.
    /// </summary>
    /// <remarks>
    /// Raised by the packet that asks for it, before the socket goes; read by
    /// DisconnectPlayer, which is what decides whether the character leaves the world with
    /// the connection or stays behind without it.
    /// </remarks>
    public bool IsOfflineVending;

    /// <summary>When the shop above gives up, measured on the server's own clock.</summary>
    public double OfflineVendingUntil;

    /// <summary>Set from the login path to ask a standing shop to close on the next tick.</summary>
    public bool OfflineVendingCloseRequested;

    //when this connection has its entity removed from the world it is no longer alive. Used to prevent queueing removal while the entity is awaiting recycling.
    //this happens because the server may remove the player AND the connection might also queue the removal of the player at the same time.
    public bool IsAlive;

    public NetworkConnection(WebSocket socket)
    {
        Socket = socket;
        AccountName = "[Account Not Loaded]";
        CancellationSource = new CancellationTokenSource();
        Cancellation = CancellationSource.Token;
        ActiveDbAction = ActiveDbAction.None;
        IsAlive = true;
    }

    public bool IsConnected => Status == ConnectionStatus.Connected;
    public bool IsConnectedAndInGame => IsConnected && Character?.IsActive == true && Character?.Map != null;
    public bool IsAdmin => Player?.IsAdmin == true;
    public bool IsOnlineAdmin => IsAdmin && IsConnectedAndInGame;
    public bool IsPlayerAlive => IsConnectedAndInGame && Character!.State != CharacterState.Dead;
}