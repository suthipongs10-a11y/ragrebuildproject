using System;
using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.Sprites;
using Assets.Scripts.UI.ConfigWindow;
using Assets.Scripts.Utility;
using RebuildSharedData.Networking;
using UnityEngine;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Network
{
    [ClientPacketHandler(PacketType.EnterServer)]
    public class PacketOnEnterServer : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var id = msg.ReadInt32();
            var mapName = msg.ReadString();
            var bytes = new byte[16];
            msg.ReadBytes(bytes, 16);
            Network.CharacterGuid = new Guid(bytes);
            PlayerPrefs.SetString("characterid", Network.CharacterGuid.ToString());

            Debug.Log($"We're id {id} on map {mapName} with guid {Network.CharacterGuid}");

            Network.CurrentMap = mapName;
            Network.PlayerId = id;
            
            UiManager.OnLogIn();

            //The manual - this server's welcome poster - used to open itself here whenever the
            //patch notes had changed since the player last looked. It no longer opens on entering
            //the game; the manual button still shows it.
            UiManager.Instance.HelpWindow.HideWindow();
            GameConfig.Data.LastViewedPatchNotes = ClientDataLoader.Instance.LatestPatchNotes;
            
            SceneTransitioner.Instance.LoadScene(Network.CurrentMap, Network.OnMapLoad);

        }
    }
}