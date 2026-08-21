using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Enum;
using RebuildSharedData.Networking;

namespace Assets.Scripts.Network.IncomingPacketHandlers.Crafting
{
    /// <summary>
    /// The server's answer about forging.
    ///
    /// Read in the order CommandBuilder.Crafting writes it, field for field.
    /// </summary>
    [ClientPacketHandler(PacketType.CraftData)]
    public class PacketCraftData : ClientPacketHandlerBase
    {
        public override void ReceivePacket(ClientInboundMessage msg)
        {
            var type = (CraftDataType)msg.ReadByte();

            switch (type)
            {
                case CraftDataType.RecipeList:
                {
                    ForgeState.Skill = (CharacterSkill)msg.ReadByte();
                    ForgeState.Recipes.Clear();

                    var count = msg.ReadByte();
                    for (var i = 0; i < count; i++)
                    {
                        var recipe = new ForgeRecipe
                        {
                            ResultId = msg.ReadInt32(),
                            ResultCount = msg.ReadByte(),
                            Chance = msg.ReadInt32(),
                            Zeny = msg.ReadInt32()
                        };

                        var materials = msg.ReadByte();
                        for (var j = 0; j < materials; j++)
                        {
                            recipe.Materials.Add(new ForgeMaterial
                            {
                                ItemId = msg.ReadInt32(),
                                Count = msg.ReadInt16()
                            });
                        }

                        ForgeState.Recipes.Add(recipe);
                    }

                    ForgeState.Received = true;
                    break;
                }

                case CraftDataType.Result:
                {
                    ForgeState.LastResult = (CraftResult)msg.ReadByte();
                    ForgeState.LastResultItem = msg.ReadInt32();
                    ForgeState.LastResultCount = msg.ReadByte();
                    ForgeState.HasResult = true;
                    break;
                }
            }

            ForgeState.Touch();
        }
    }
}
