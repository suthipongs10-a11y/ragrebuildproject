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

    /// <summary>How many may be inside at once, the owner included.</summary>
    public int Limit = ChatRoomNpcProxy.MaxMembers;

    /// <summary>Empty for a room anyone may walk into, which is most of them.</summary>
    public string Password = "";

    public readonly List<Entity> Members = new();

    public bool IsLocked => !string.IsNullOrEmpty(Password);
}

public class ChatRoomNpcProxy : NpcBehaviorBase
{
    public const int MaxMembers = 20;
    public const int MinMembers = 2;
    public const int MaxTitleLength = 32;
    public const int MaxPasswordLength = 16;
    public const int MemberMaxDistance = 4;

    /// <summary>
    /// Stuck on the front of a locked room's sign so the client can tell one from an open
    /// room without being sent anything extra.
    /// </summary>
    /// <remarks>
    /// The sign's text is the proxy npc's name, and the name is all the client is given
    /// about a room it has not joined. A control character is used rather than a word or a
    /// padlock because it cannot be typed into a title, cannot be confused for one, and is
    /// stripped before the title is ever drawn. Kept in step with the same constant in the
    /// client's VendAndChatManager.
    /// </remarks>
    public const char LockedMarker = '\u0001';

    private static readonly Dictionary<int, ChatRoom> activeRooms = new();

    public static void CreateRoom(Player player, string title) => CreateRoom(player, title, MaxMembers, "");

    public static void CreateRoom(Player player, string title, int limit, string password)
    {
        var character = player.Character;
        var map = character.Map;
        if (map == null)
            return;

        if (player.ChatRoom != null)
        {
            CommandBuilder.ErrorMessage(player, "อยู่ในห้องแชทอยู่แล้ว ออกจากห้องเดิมก่อน");
            return;
        }

        if (character.State == CharacterState.Dead || player.IsInNpcInteraction)
            return;

        if (title.Length > MaxTitleLength)
            title = title.Substring(0, MaxTitleLength);

        //The title reaches other players as the npc's name, and the marker that says a room
        //is locked is a character in that name - so a title carrying one of its own would
        //make an open room look locked and be refused at the door.
        title = title.Replace(LockedMarker, ' ').Trim();
        if (string.IsNullOrWhiteSpace(title))
        {
            CommandBuilder.ErrorMessage(player, "A chat room needs a title.");
            return;
        }

        password ??= "";
        if (password.Length > MaxPasswordLength)
            password = password.Substring(0, MaxPasswordLength);

        limit = Math.Clamp(limit, MinMembers, MaxMembers);

        if (map.CheckIfNpcNearby(character, 4))
        {
            CommandBuilder.ErrorMessage(player, "อยู่ใกล้ NPC เกินไป เปิดห้องแชทตรงนี้ไม่ได้");
            return;
        }

        var e = World.Instance.CreateEvent(character.Entity, map, "ChatRoomNpcProxy", character.Position, 0, 0, 0, 0, null);
        if (!e.TryGet<Npc>(out var proxy))
        {
            ServerLogger.LogWarning($"Failed to create chat room proxy.");
            CommandBuilder.ErrorMessage(player, "เปิดห้องแชทไม่สำเร็จ");
            return;
        }

        proxy.ChangeNpcClass("EFFECT");
        //The name that reaches other clients is the world object's, not the npc's: the
        //spawn packet is built from the character. Setting only the npc's left every sign
        //in the world reading the event's own name instead of the room's, while the store
        //window - which is sent the npc name - showed the right one.
        //The lock is worn on the sign rather than sent, see LockedMarker.
        var sign = password.Length > 0 ? LockedMarker + title : title;
        proxy.Name = sign;
        proxy.FullName = sign;
        proxy.Character.Name = sign;
        proxy.HasInteract = true;
        proxy.ExpireEventWithoutOwner = true;
        proxy.DisplayType = NpcDisplayType.ChatRoomProxy;
        proxy.RevealToPlayers();

        var room = new ChatRoom
        {
            Proxy = e, Owner = character.Entity, Title = title, Limit = limit, Password = password
        };
        room.Members.Add(character.Entity);
        player.ChatRoom = room;
        activeRooms[e.Id] = room;

        CommandBuilder.AddRecipient(character.Entity);
        CommandBuilder.SendServerMessage($"เปิดห้องแชท \"{title}\" แล้ว (สูงสุด {limit} คน"
                                         + (password.Length > 0 ? ", มีรหัส)" : ")")
                                         + " ปิดห้องด้วยการพิมพ์ /chat หรือเดินออกไป");
        CommandBuilder.ClearRecipients();
    }

    /// <summary>
    /// Walks into a room that asked for a password, which is the one door a plain click
    /// cannot open.
    /// </summary>
    /// <remarks>
    /// The npc id is the one the client was given when the sign was drawn, and it is looked
    /// up the same way a click on any other npc is - so a made-up id finds nothing, and an
    /// id belonging to something that is not a chat room falls through to the same refusal.
    /// </remarks>
    public static void JoinRoom(Player player, int npcId, string password)
    {
        var entity = World.Instance.GetEntityById(npcId);
        if (entity.Type != EntityType.Npc || entity.IsNull() || !entity.IsAlive()
            || !entity.TryGet<Npc>(out var npc)
            || !activeRooms.TryGetValue(npc.Entity.Id, out var room))
        {
            CommandBuilder.ErrorMessage(player, "ไม่พบห้องแชทนั้นแล้ว");
            return;
        }

        TryAdmit(npc, player, room, password ?? "");
    }

    public static void LeaveRoom(Player player)
    {
        var room = player.ChatRoom;
        if (room == null)
        {
            CommandBuilder.ErrorMessage(player, "ยังไม่ได้อยู่ในห้องแชท เปิดห้องได้ที่ปุ่มห้องแชท หรือพิมพ์ /chat <ชื่อห้อง>");
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

        RemoveMember(room, player.Character.Entity, $"{player.Name} ออกจากห้องแชท");
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
                RemoveMember(room, member, p != null ? $"{p.Name} ออกจากห้องแชท" : null);
            }
        }
    }

    public override NpcInteractionResult OnClick(Npc npc, Player player, NpcInteractionState state)
    {
        if (activeRooms.TryGetValue(npc.Entity.Id, out var room))
            TryAdmit(npc, player, room, "");

        return NpcInteractionResult.EndInteraction;
    }

    /// <summary>
    /// The door, wherever the knock came from: a click on the sign, or a click that came
    /// back carrying a password.
    /// </summary>
    private static void TryAdmit(Npc npc, Player player, ChatRoom room, string password)
    {
        if (player.ChatRoom == room)
            return;

        if (room.IsLocked && password != room.Password)
        {
            //Said the same way whether the password was wrong or simply not offered, so a
            //click on a locked sign is what tells the client to ask for one.
            CommandBuilder.ErrorMessage(player, "ห้องนี้ต้องใส่รหัสผ่าน");
            return;
        }

        if (room.Members.Count >= room.Limit)
        {
            CommandBuilder.ErrorMessage(player, "ห้องแชทนี้เต็มแล้ว");
            return;
        }

        if (player.Character.Position.DistanceTo(npc.Character.Position) > MemberMaxDistance)
        {
            CommandBuilder.ErrorMessage(player, "อยู่ไกลเกินไป เข้าห้องแชทนี้ไม่ได้");
            return;
        }

        //Left only once the new room has agreed to take them, so a refused knock does not
        //cost somebody the room they were already sitting in.
        if (player.ChatRoom != null)
            LeaveRoom(player);

        room.Members.Add(player.Character.Entity);
        player.ChatRoom = room;
        Announce(room, $"{player.Name} เข้าห้องแชท ({room.Members.Count}/{room.Limit})");
    }

    public override void OnEventEnd(Npc npc)
    {
        if (!activeRooms.Remove(npc.Entity.Id, out var room))
            return;

        Announce(room, "ห้องแชทปิดแล้ว");
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
