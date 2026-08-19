using RebuildSharedData.Enum;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents.Character;
using RoRebuildServer.EntitySystem;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation;
using RoRebuildServer.Simulation.Pathfinding;

namespace RoRebuildServer.EntityComponents.Npcs;

//A chat room works like a vending shop without the shop: an event npc marks the
//room with a floating title box, players click the box to join, and say text from
//members is routed only to other members. The room closes when its owner walks
//away, and members drop out when they wander off, die, or leave the map.
public class ChatRoom
{
    public Entity Proxy;
    public Entity Owner;
    public string Title = "";
    public readonly List<Entity> Members = new();
}

public class ChatRoomNpcProxy : NpcBehaviorBase
{
    public const int MaxMembers = 20;
    public const int MaxTitleLength = 32;
    public const int MemberMaxDistance = 4;

    private static readonly Dictionary<int, ChatRoom> activeRooms = new();

    public static void CreateRoom(Player player, string title)
    {
        var character = player.Character;
        var map = character.Map;
        if (map == null)
            return;

        if (player.ChatRoom != null)
        {
            CommandBuilder.ErrorMessage(player, "You are already in a chat room. Type /chat to leave it first.");
            return;
        }

        if (character.State == CharacterState.Dead || player.IsInNpcInteraction)
            return;

        if (title.Length > MaxTitleLength)
            title = title.Substring(0, MaxTitleLength);

        if (map.CheckIfNpcNearby(character, 4))
        {
            CommandBuilder.ErrorMessage(player, "You can't open a chat room this close to an npc.");
            return;
        }

        var e = World.Instance.CreateEvent(character.Entity, map, "ChatRoomNpcProxy", character.Position, 0, 0, 0, 0, null);
        if (!e.TryGet<Npc>(out var proxy))
        {
            ServerLogger.LogWarning($"Failed to create chat room proxy.");
            CommandBuilder.ErrorMessage(player, "Failed to open the chat room.");
            return;
        }

        proxy.ChangeNpcClass("EFFECT");
        //The name that reaches other clients is the world object's, not the npc's: the
        //spawn packet is built from the character. Setting only the npc's left every sign
        //in the world reading the event's own name instead of the room's, while the store
        //window - which is sent the npc name - showed the right one.
        proxy.Name = title;
        proxy.FullName = title;
        proxy.Character.Name = title;
        proxy.HasInteract = true;
        proxy.ExpireEventWithoutOwner = true;
        proxy.DisplayType = NpcDisplayType.ChatRoomProxy;
        proxy.RevealToPlayers();

        var room = new ChatRoom { Proxy = e, Owner = character.Entity, Title = title };
        room.Members.Add(character.Entity);
        player.ChatRoom = room;
        activeRooms[e.Id] = room;

        CommandBuilder.AddRecipient(character.Entity);
        CommandBuilder.SendServerMessage($"Chat room \"{title}\" is open. Type /chat again to close it, or walk away.");
        CommandBuilder.ClearRecipients();
    }

    public static void LeaveRoom(Player player)
    {
        var room = player.ChatRoom;
        if (room == null)
        {
            CommandBuilder.ErrorMessage(player, "You aren't in a chat room. Use /chat <title> to open one.");
            return;
        }

        if (room.Owner == player.Character.Entity)
        {
            //the owner closing the room closes it for everyone, cleanup runs in OnEventEnd
            if (room.Proxy.TryGet<Npc>(out var npc))
                npc.EndEvent();
            else
                player.ChatRoom = null; //proxy already gone somehow, just detach
            return;
        }

        RemoveMember(room, player.Character.Entity, $"{player.Name} left the chat room.");
    }

    public static void SayToRoom(ChatRoom room, WorldObject speaker, string name, string text)
    {
        var hasRecipient = false;
        foreach (var member in room.Members)
        {
            if (!member.IsAlive())
                continue;
            CommandBuilder.AddRecipient(member);
            hasRecipient = true;
        }

        if (hasRecipient)
            CommandBuilder.SendSayMulti(speaker, name, text, PlayerChatType.ChatRoom);
        CommandBuilder.ClearRecipients();
    }

    private static void RemoveMember(ChatRoom room, Entity member, string? announcement)
    {
        room.Members.Remove(member);
        if (member.TryGet<Player>(out var player) && player.ChatRoom == room)
            player.ChatRoom = null;
        if (announcement != null)
            Announce(room, announcement);
    }

    private static void Announce(ChatRoom room, string text)
    {
        var hasRecipient = false;
        foreach (var member in room.Members)
        {
            if (!member.IsAlive())
                continue;
            CommandBuilder.AddRecipient(member);
            hasRecipient = true;
        }

        if (hasRecipient)
            CommandBuilder.SendServerMessage(text);
        CommandBuilder.ClearRecipients();
    }

    public override void Init(Npc npc)
    {
        npc.StartTimer(500);
    }

    public override void OnTimer(Npc npc, float lastTime, float newTime)
    {
        if (!activeRooms.TryGetValue(npc.Entity.Id, out var room))
        {
            npc.EndEvent();
            return;
        }

        //the room follows vending rules, it only exists while its owner stands on it
        if (!npc.Owner.TryGet<Player>(out var owner)
            || !npc.Character.IsPlayerVisible(npc.Owner)
            || npc.Character.Position.DistanceTo(owner.Character.Position) > 1
            || owner.ChatRoom != room)
        {
            npc.EndEvent();
            return;
        }

        for (var i = room.Members.Count - 1; i >= 0; i--)
        {
            var member = room.Members[i];
            if (member == room.Owner)
                continue;

            if (!member.TryGet<Player>(out var p)
                || p.Character.Map != npc.Character.Map
                || p.Character.State == CharacterState.Dead
                || p.Character.Position.DistanceTo(npc.Character.Position) > MemberMaxDistance
                || p.ChatRoom != room)
            {
                RemoveMember(room, member, p != null ? $"{p.Name} left the chat room." : null);
            }
        }
    }

    public override NpcInteractionResult OnClick(Npc npc, Player player, NpcInteractionState state)
    {
        if (activeRooms.TryGetValue(npc.Entity.Id, out var room) && player.ChatRoom != room)
        {
            if (player.ChatRoom != null)
                LeaveRoom(player);

            if (room.Members.Count >= MaxMembers)
                CommandBuilder.ErrorMessage(player, "That chat room is full.");
            else if (player.Character.Position.DistanceTo(npc.Character.Position) > MemberMaxDistance)
                CommandBuilder.ErrorMessage(player, "You are too far away to join that chat room.");
            else
            {
                room.Members.Add(player.Character.Entity);
                player.ChatRoom = room;
                Announce(room, $"{player.Name} joined the chat room.");
            }
        }

        return NpcInteractionResult.EndInteraction;
    }

    public override void OnEventEnd(Npc npc)
    {
        if (!activeRooms.Remove(npc.Entity.Id, out var room))
            return;

        Announce(room, "The chat room has closed.");
        foreach (var member in room.Members)
        {
            if (member.TryGet<Player>(out var p) && p.ChatRoom == room)
                p.ChatRoom = null;
        }
        room.Members.Clear();
    }
}

public class ChatRoomProxyEventLoader : INpcLoader
{
    public void Load()
    {
        DataManager.RegisterEvent("ChatRoomNpcProxy", new ChatRoomNpcProxy());
    }
}
