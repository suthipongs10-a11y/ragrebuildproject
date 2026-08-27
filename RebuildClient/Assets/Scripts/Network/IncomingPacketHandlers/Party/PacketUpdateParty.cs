using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.UI.Hud;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Party
{
    [ClientPacketHandler(PacketType.UpdateParty)]
    public class PacketUpdateParty : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var updateType = (PartyUpdateType)msg.ReadByte();
            switch (updateType)
            {
                case PartyUpdateType.AddPlayer:
                    var newMember = PartyPacketHelpers.LoadPartyMemberInfo(msg);
                    State.RegisterOrUpdatePartyMember(newMember);
                    Camera.AppendChatText($"{ChatColor.Party}{newMember.PlayerName} เข้าปาร์ตี้แล้ว</color>");
                    UiManager.Instance.PartyPanel.AddPartyMember(newMember);
                    break;
                case PartyUpdateType.LogIn:
                case PartyUpdateType.LogOut:
                case PartyUpdateType.UpdatePlayer:
                    var memberInfo = PartyPacketHelpers.LoadPartyMemberInfo(msg);
                    
                    if(updateType == PartyUpdateType.LogIn)
                        Camera.AppendChatText($"{ChatColor.Party}{memberInfo.PlayerName} ออนไลน์แล้ว</color>");
                    if(updateType == PartyUpdateType.LogOut)
                        Camera.AppendChatText($"{ChatColor.Party}{memberInfo.PlayerName} ออฟไลน์แล้ว</color>");
                    State.RegisterOrUpdatePartyMember(memberInfo);
                    UiManager.Instance.PartyPanel.RefreshPartyMember(memberInfo.PartyMemberId);
                    break;
                case PartyUpdateType.RemovePlayer:
                    var removePartyId = msg.ReadInt32();
                    var existing = State.RemovePartyMember(removePartyId);
                    if (existing.EntityId == Network.PlayerId)
                    {
                        updateType = PartyUpdateType.LeaveParty;
                        goto case PartyUpdateType.LeaveParty;
                    }
                    UiManager.Instance.PartyPanel.RemovePartyMember(removePartyId);
                    Camera.AppendChatText($"{ChatColor.Party}{existing.PlayerName} ออกจากปาร์ตี้แล้ว</color>");
                    break;
                case PartyUpdateType.ChangeLeader:
                    var newLeaderId = msg.ReadInt32();
                    if (State.PartyMembers.TryGetValue(newLeaderId, out var leader))
                    {
                        var oldLeaderId = State.PartyLeader;
                        if (State.PartyMembers.TryGetValue(oldLeaderId, out var oldLeader))
                            oldLeader.IsLeader = false;

                        leader.IsLeader = true;
                        State.PartyLeader = newLeaderId;
                        
                        if (newLeaderId == State.PartyMemberId)
                            Camera.AppendChatText($"{ChatColor.Party}คุณเป็นหัวหน้าปาร์ตี้แล้ว</color>");
                        else
                            Camera.AppendChatText($"{ChatColor.Party}{leader.PlayerName} เป็นหัวหน้าปาร์ตี้แล้ว</color>");
                        State.UpdatePlayerName(); //add party leader indicator (or remove it)
                        UiManager.Instance.PartyPanel.RefreshPartyMember(newLeaderId);
                        UiManager.Instance.PartyPanel.RefreshPartyMember(oldLeaderId);
                    }
                    break;
                case PartyUpdateType.UpdateMap:
                    if (State.PartyMembers.TryGetValue(msg.ReadInt32(), out var mapUpdatePlayer))
                    {
                        mapUpdatePlayer.Map = msg.ReadString();
                        UiManager.Instance.PartyPanel.RefreshPartyMember(mapUpdatePlayer.PartyMemberId);
                    }
                    break;
                case PartyUpdateType.UpdateHpSp:
                    if (State.PartyMembers.TryGetValue(msg.ReadInt32(), out var hpUpdatePlayer))
                    {
                        hpUpdatePlayer.Hp = msg.ReadInt32();
                        hpUpdatePlayer.MaxHp = msg.ReadInt32();
                        hpUpdatePlayer.Sp = msg.ReadInt32();
                        hpUpdatePlayer.MaxSp = msg.ReadInt32();
                        UiManager.Instance.PartyPanel.UpdateHpSpOfPartyMember(hpUpdatePlayer.PartyMemberId);
                    }
                    break;
                case PartyUpdateType.FullRefresh:
                    //Answering the party window's own request, so there is nothing to say in
                    //chat: the player is looking straight at the thing that changed.
                    //
                    //Emptied first because this roster is the whole truth, not a change to it.
                    //Anyone the server left out has left, and keeping them because no removal
                    //packet happened to arrive is how a window ends up listing a ghost.
                    State.PartyMembers.Clear();
                    State.PartyMemberEntityLookup.Clear();
                    State.PartyMemberIdLookup.Clear();
                    PacketAcceptPartyInvite.LoadPartyMemberDetails(msg);
                    UiManager.Instance.PartyPanel.FullRefreshPartyMemberPanel();
                    break;
                case PartyUpdateType.ChangeExpShare:
                    State.PartyShareExp = msg.ReadByte() == 1;
                    Camera.AppendChatText(State.PartyShareExp
                        ? $"{ChatColor.Party}ปาร์ตี้นี้แบ่ง EXP ให้สมาชิกทุกคนแล้ว</color>"
                        : $"{ChatColor.Party}ปาร์ตี้นี้เลิกแบ่ง EXP แล้ว ใครฆ่าคนนั้นได้</color>");
                    break;
                case PartyUpdateType.LeaveParty:
                case PartyUpdateType.DisbandParty:
                    if(updateType == PartyUpdateType.LeaveParty)
                        Camera.AppendChatText($"{ChatColor.Party}คุณออกจากปาร์ตี้แล้ว</color>");
                    if(updateType == PartyUpdateType.DisbandParty)
                        Camera.AppendChatText($"{ChatColor.Party}ปาร์ตี้ถูกยุบแล้ว</color>");
                    State.IsInParty = false;
                    State.PartyMembers.Clear();
                    State.PartyMemberEntityLookup.Clear();
                    State.PartyMemberIdLookup.Clear();
                    //back to the default, so the next party is not described by the last one's
                    //setting before its own first packet arrives
                    State.PartyShareExp = true;
                    State.UpdatePlayerName();
                    UiManager.Instance.PartyPanel.FullRefreshPartyMemberPanel();
                    MinimapController.Instance.RefreshPartyMembers();
                    if (Camera.TargetControllable != null)
                        Camera.TargetControllable.PartyName = null;
                    break;
            }
        }
    }
}