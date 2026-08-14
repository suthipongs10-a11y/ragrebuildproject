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
            var title = msg.ReadString();
            if (connection.Character == null || connection.Player == null)
                return;

            if (string.IsNullOrWhiteSpace(title))
                EntityComponents.Npcs.ChatRoomNpcProxy.LeaveRoom(connection.Player);
            else
                EntityComponents.Npcs.ChatRoomNpcProxy.CreateRoom(connection.Player, title.Trim());
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
}