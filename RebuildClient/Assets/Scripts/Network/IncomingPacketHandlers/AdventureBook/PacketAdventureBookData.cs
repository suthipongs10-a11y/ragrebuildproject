using System.Collections.Generic;
using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.AdventureBook
{
    /// <summary>
    /// The server's answer about the adventure book.
    ///
    /// Read in the order CommandBuilder.SendAdventureBook writes it, field for field. Nothing
    /// here is optional and nothing may be skipped: a field read out of order does not fail,
    /// it quietly turns the rest of the packet into nonsense.
    /// </summary>
    [ClientPacketHandler(PacketType.AdventureBookData)]
    public class PacketAdventureBookData : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var type = (AdventureBookDataType)msg.ReadByte();

            switch (type)
            {
                case AdventureBookDataType.Header:
                    ReadHeader(msg);
                    break;

                case AdventureBookDataType.Pages:
                    ReadPages(msg);
                    break;

                case AdventureBookDataType.Complete:
                    AdventureBookState.Received = true;
                    break;

                case AdventureBookDataType.PageUpdate:
                    ReadPage(msg);
                    break;
            }

            AdventureBookState.Touch();
        }

        private static void ReadHeader(ClientInboundMessage msg)
        {
            AdventureBookState.Clear();

            AdventureBookState.Rank = msg.ReadByte();
            AdventureBookState.Stars = msg.ReadInt16();
            AdventureBookState.StarTotal = msg.ReadInt16();
            AdventureBookState.StarsForNextRank = msg.ReadInt16();

            var regionCount = msg.ReadByte();
            for (var i = 0; i < regionCount; i++)
            {
                AdventureBookState.Regions.Add(new AdventureBookRegionInfo
                {
                    Name = msg.ReadString(),
                    RewardCode = msg.ReadString(),
                    Complete = msg.ReadByte() != 0
                });
            }
        }

        /// <summary>
        /// One batch of pages, appended to whatever the header started.
        /// </summary>
        /// <remarks>
        /// The book arrives in several of these because the server's outbound buffer refuses
        /// to grow past a few thousand bytes. Order does not matter: every page names the
        /// region it belongs to.
        /// </remarks>
        private static void ReadPages(ClientInboundMessage msg)
        {
            var pageCount = msg.ReadInt16();
            for (var i = 0; i < pageCount; i++)
            {
                var page = new AdventureBookPage
                {
                    PageId = msg.ReadInt32(),
                    RegionIndex = msg.ReadByte(),
                    Name = msg.ReadString(),
                    Members = msg.ReadString(),
                    Level = msg.ReadInt16(),
                    HuntTarget = msg.ReadInt16(),
                    HuntTargetLarge = msg.ReadInt16(),
                    CardItemId = msg.ReadInt32(),
                    Kills = msg.ReadInt32(),
                    Stars = msg.ReadByte()
                };

                var sightingCount = msg.ReadByte();
                page.Sightings = new List<AdventureBookSighting>(sightingCount);
                for (var s = 0; s < sightingCount; s++)
                {
                    page.Sightings.Add(new AdventureBookSighting
                    {
                        Map = msg.ReadString(),
                        Count = msg.ReadInt16()
                    });
                }

                AdventureBookState.PagesById[page.PageId] = page;

                //A region index the server never sent would be a book built against a
                //different list, so the page is dropped rather than drawn under the wrong
                //heading - which would read as a bug in the book rather than in the wire.
                if (page.RegionIndex >= 0 && page.RegionIndex < AdventureBookState.Regions.Count)
                    AdventureBookState.Regions[page.RegionIndex].Pages.Add(page);
            }
        }

        private static void ReadPage(ClientInboundMessage msg)
        {
            var pageId = msg.ReadInt32();
            var kills = msg.ReadInt32();
            var stars = msg.ReadByte();
            AdventureBookState.Rank = msg.ReadByte();
            AdventureBookState.Stars = msg.ReadInt16();

            //Only updates a page the book already holds. A page arriving for a book that was
            //never asked for has nowhere to go, and inventing one would leave it without the
            //region it belongs to.
            if (!AdventureBookState.PagesById.TryGetValue(pageId, out var page))
                return;

            page.Kills = kills;
            page.Stars = stars;
        }
    }
}
