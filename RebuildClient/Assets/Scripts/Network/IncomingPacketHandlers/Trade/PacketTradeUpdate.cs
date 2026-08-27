using System.Collections.Generic;
using Assets.Scripts.Network.HandlerBase;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.UI;
using Assets.Scripts.UI.Trading;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;
using Assets.Scripts.UI.Utility;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Trading
{
    /// <summary>
    /// Everything the server says about a trade, behind one update byte.
    ///
    /// Both offers are read from what arrives rather than kept from what this client thinks
    /// it put down. A trade is the one place where showing something that is not what is
    /// actually being offered is the entire problem, so the window is told, never asked.
    /// </summary>
    [ClientPacketHandler(PacketType.TradeUpdate)]
    public class PacketTradeUpdate : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var updateType = (TradeUpdateType)msg.ReadByte();

            switch (updateType)
            {
                case TradeUpdateType.Requested:
                {
                    var who = msg.ReadString();
                    //the entity id is read whether or not it is used, because the rest of the
                    //buffer is read from wherever this leaves off
                    msg.ReadInt32();

                    Camera.AppendChatText($"{ChatColor.Party}{who} ขอแลกเปลี่ยนของกับเรา</color>");

                    //One answer, whichever way it is given.
                    //
                    //The prompt runs its no action on hide as well as on the button, and
                    //hides itself after the yes - so without this, accepting sends an accept
                    //and then a decline straight after it, and declining sends two declines.
                    //The flag is what makes the first answer the only one.
                    var answered = false;

                    UiManager.Instance.YesNoOptionsWindow.BeginPrompt(
                        $"{who} ขอแลกเปลี่ยนของด้วย ตกลงไหม", "ตกลง", "ไม่",
                        () =>
                        {
                            if (answered)
                                return;
                            answered = true;
                            NetworkManager.Instance.SendTradeAction(TradeAction.Accept);
                        },
                        () =>
                        {
                            if (answered)
                                return;
                            answered = true;
                            NetworkManager.Instance.SendTradeAction(TradeAction.Decline);
                        },
                        //declined on close as well: a prompt dismissed some other way would
                        //otherwise leave the asker waiting on an answer that never comes, and
                        //both of them unable to trade with anyone else
                        true, true, "คำขอแลกเปลี่ยน", Assets.Scripts.UI.ModernUiIcons.Bag);
                    break;
                }

                case TradeUpdateType.Started:
                    TradeWindow.Begin(msg.ReadString());
                    break;

                case TradeUpdateType.Offer:
                {
                    var mine = msg.ReadByte() == 1;
                    var zeny = msg.ReadInt32();
                    var count = msg.ReadInt32();

                    var items = new List<OfferedItem>(count);
                    for (var i = 0; i < count; i++)
                    {
                        var bagId = msg.ReadInt32();
                        items.Add(new OfferedItem
                        {
                            BagId = bagId,
                            Item = InventoryItem.DeserializeWithType(msg, bagId)
                        });
                    }

                    TradeWindow.SetOffer(mine, zeny, items);
                    break;
                }

                case TradeUpdateType.LockChanged:
                {
                    //read into locals rather than straight into the arguments: the order the
                    //four come off the wire is the whole meaning of them, and a reader should
                    //not have to know that C# evaluates arguments left to right to see it
                    var mineLocked = msg.ReadByte() == 1;
                    var theirsLocked = msg.ReadByte() == 1;
                    var mineConfirmed = msg.ReadByte() == 1;
                    var theirsConfirmed = msg.ReadByte() == 1;

                    TradeWindow.SetLocks(mineLocked, theirsLocked, mineConfirmed, theirsConfirmed);
                    break;
                }

                case TradeUpdateType.Completed:
                    //Completed rather than Finish: this is the one ending that has something
                    //to say beyond that it happened, and the window is the only place the
                    //two offers exist to say it from.
                    TradeWindow.Completed();
                    break;

                case TradeUpdateType.Cancelled:
                    TradeWindow.Cancelled(msg.ReadString());
                    break;
            }
        }
    }
}
