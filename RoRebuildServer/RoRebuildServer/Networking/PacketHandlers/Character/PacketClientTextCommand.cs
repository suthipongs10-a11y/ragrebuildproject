using RebuildSharedData.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Networking.PacketHandlers.Character;

[ClientPacketHandler(PacketType.ClientTextCommand)]
public class PacketClientTextCommand : IClientPacketHandler
{
    public void Process(NetworkConnection connection, InboundMessage msg)
    {
        if (!connection.IsConnectedAndInGame || connection.Character == null || connection.Player == null)
            return;

        if (connection.Player.InInputActionCooldown())
            return;

        connection.Player.AddInputActionDelay(0.8f);

        var type = (ClientTextCommand)msg.ReadByte();

        if (type == ClientTextCommand.Adminify && ServerConfig.OperationConfig.AllowAdminifyCommand)
        {
            var text = msg.ReadString();
            var serverPass = ServerConfig.OperationConfig.AdminifyPasscode;
            if (!string.IsNullOrWhiteSpace(serverPass) && text != serverPass)
            {
                CommandBuilder.ErrorMessage(connection.Player, $"Invalid parameters.");
                connection.Player.AddInputActionDelay(1.2f);
                return;
            }

            connection.Player.IsAdmin = true;

            CommandBuilder.AddRecipient(connection.Entity);
            CommandBuilder.SendServerMessage($"You are now an admin! Have fun!");
            CommandBuilder.ClearRecipients();
        }

        if (type == ClientTextCommand.ReturnToSave)
        {
            //the unstuck option in the escape menu, this is the same trip a butterfly
            //wing makes and unlike respawning it works while the character is alive
            if (connection.Character == null || connection.Player == null)
                return;
            if (connection.Character.State == RebuildSharedData.Enum.CharacterState.Dead)
                return;

            connection.Player.ReturnToSavePoint();
            return;
        }

        if (type == ClientTextCommand.Guild)
        {
            var arguments = msg.ReadString();
            if (connection.Character == null || connection.Player == null)
                return;

            Simulation.Guilds.GuildCommands.Handle(connection, arguments);
            return;
        }

        if (type == ClientTextCommand.ChatRoom)
        {
            var arguments = msg.ReadString();
            if (connection.Character == null || connection.Player == null)
                return;

            HandleChatRoom(connection.Player, arguments);
            return;
        }

        if (type == ClientTextCommand.Zeny)
        {
            //the string is read before anything else so the message is always consumed
            //the same way no matter which branch below takes over
            var amountText = msg.ReadString();
            var player = connection.Player;

            if (!player.IsAdmin)
            {
                CommandBuilder.ErrorMessage(player, "You do not have permission to use that command.");
                return;
            }

            if (!int.TryParse(amountText, out var amount) || amount == 0)
            {
                CommandBuilder.ErrorMessage(player, "Usage: /zeny <amount>. A negative amount takes it away.");
                return;
            }

            if (amount > 0)
                player.AddZeny(amount);
            else
                player.DropZeny(-amount);

            //AddZeny only changes the stored value, the client is told separately
            CommandBuilder.SendUpdateZeny(player);

            CommandBuilder.AddRecipient(connection.Entity);
            CommandBuilder.SendServerMessage($"You now have {player.GetZeny():N0} zeny.");
            CommandBuilder.ClearRecipients();
            return;
        }

        if (type == ClientTextCommand.Where)
        {
            CommandBuilder.AddRecipient(connection.Entity);
            CommandBuilder.SendServerMessage($"You are at {connection.Character.Position} on map {connection.Character.Map!.Name}.");
            CommandBuilder.ClearRecipients();
        }

        if (type == ClientTextCommand.Info)
        {
            var text = $"There are {NetworkManager.PlayerCount} players online and the server has been online for {TimeSpan.FromSeconds(Time.ElapsedTime):c}.";

            CommandBuilder.AddRecipient(connection.Entity);
            CommandBuilder.SendServerMessage(text);
            CommandBuilder.ClearRecipients();
        }
    }

    /// <summary>
    /// Everything the chat room window and the /chat command ask for, which all arrives as
    /// one string.
    /// </summary>
    /// <remarks>
    /// One command rather than three because a new command is a new value in a shared enum,
    /// and a shared enum reaches the client as a compiled library that has to be copied
    /// across by hand - so a feature that could be spelled inside the string it already
    /// sends is spelled there instead.
    ///
    /// The separator is a control character on purpose: it cannot be typed into a room
    /// title, so an ordinary "/chat my room" can never be mistaken for a structured
    /// request, and a title containing anything at all still arrives whole.
    /// </remarks>
    private static void HandleChatRoom(EntityComponents.Player player, string arguments)
    {
        const char sep = '\u001f';

        //bare: close the room you own, or step out of the one you joined
        if (string.IsNullOrWhiteSpace(arguments))
        {
            EntityComponents.Npcs.ChatRoomNpcProxy.LeaveRoom(player);
            return;
        }

        var parts = arguments.Split(sep);

        //"c" title limit password - the window's create button
        if (parts.Length == 4 && parts[0] == "c")
        {
            if (!int.TryParse(parts[2], out var limit))
                limit = EntityComponents.Npcs.ChatRoomNpcProxy.MaxMembers;
            EntityComponents.Npcs.ChatRoomNpcProxy.CreateRoom(player, parts[1].Trim(), limit, parts[3]);
            return;
        }

        //"j" npcId password - knocking on a room that asked for one
        if (parts.Length == 3 && parts[0] == "j")
        {
            if (int.TryParse(parts[1], out var npcId))
                EntityComponents.Npcs.ChatRoomNpcProxy.JoinRoom(player, npcId, parts[2]);
            return;
        }

        //anything else is a title typed straight into chat, which is how this started
        EntityComponents.Npcs.ChatRoomNpcProxy.CreateRoom(player, arguments.Trim());
    }
}