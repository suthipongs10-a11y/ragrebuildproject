using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// Cards into dust, which is the only ingredient the trade window cannot ask for.
/// </summary>
/// <remarks>
/// An npc trade takes named items - "a Poring Card", never "any card" - so a recipe that
/// wants a card of some sort has nowhere to put that. Grinding is the way round it, and it
/// turned out to be the better system anyway: four hundred and forty-one card types exist
/// and most of a long-running server's cards are ones nobody will ever socket.
///
/// Boss cards are refused. Not by a list kept by hand, which would go stale the first time
/// a monster changed - by asking what dropped the card and whether that thing was a boss.
/// A card nothing drops is refused too, since that is a card handed out by something other
/// than hunting and grinding it is not what anybody meant.
/// </remarks>
public static class CardGrindSystem
{
    public const string DustCode = "Card_Dust";

    /// <summary>Built on first use, from the drop tables the server already has.</summary>
    private static HashSet<int>? bossCards;

    public static int DustPerCard => 1;

    /// <summary>
    /// Every card that a boss or an mvp drops, worked out once.
    /// </summary>
    /// <remarks>
    /// Reading the drop tables rather than naming the cards means this is right by
    /// construction: move a card onto a boss and it becomes unbreakable, take it off and it
    /// does not, with nothing to remember to edit.
    /// </remarks>
    private static HashSet<int> BossCards()
    {
        if (bossCards != null)
            return bossCards;

        bossCards = new HashSet<int>();

        foreach (var (code, drops) in DataManager.MonsterDropData)
        {
            if (!DataManager.MonsterCodeLookup.TryGetValue(code, out var monster))
                continue;

            if (monster.Special != CharacterSpecialType.Boss)
                continue;

            foreach (var drop in drops.DropChances)
            {
                if (DataManager.ItemList.TryGetValue(drop.Id, out var item) && item.ItemClass == ItemClass.Card)
                    bossCards.Add(drop.Id);
            }
        }

        ServerLogger.Log($"[CardGrind] {bossCards.Count} card(s) come off bosses and cannot be ground.");
        return bossCards;
    }

    /// <summary>Whether this item is a card the scribe will take, and why not if it is not.</summary>
    public static bool CanGrind(int itemId, out string refusal)
    {
        refusal = "";

        if (!DataManager.ItemList.TryGetValue(itemId, out var item) || item.ItemClass != ItemClass.Card)
        {
            refusal = "นั่นไม่ใช่การ์ด";
            return false;
        }

        if (BossCards().Contains(itemId))
        {
            refusal = "การ์ดบอสบดไม่ได้";
            return false;
        }

        return true;
    }

    public static bool TryGrind(Player player, int itemId, int count)
    {
        var inventory = player.Inventory;
        if (inventory == null)
            return false;

        if (!CanGrind(itemId, out var refusal))
        {
            CommandBuilder.ErrorMessage(player, refusal);
            return false;
        }

        count = int.Clamp(count, 1, 100);

        var held = inventory.GetItemCount(itemId);
        if (held < count)
        {
            CommandBuilder.ErrorMessage(player, "การ์ดในกระเป๋าไม่พอ");
            return false;
        }

        if (!DataManager.ItemIdByName.TryGetValue(DustCode, out var dustId))
        {
            ServerLogger.LogWarning($"[CardGrind] there is no item called '{DustCode}', so nothing can be ground.");
            return false;
        }

        var dust = count * DustPerCard;
        if (!player.CanPickUpItem(new ItemReference(dustId, dust)))
        {
            CommandBuilder.ErrorMessage(player, "กระเป๋าเต็ม เอาของออกก่อน");
            return false;
        }

        if (!player.TryRemoveItemFromInventory(itemId, count, true))
        {
            CommandBuilder.ErrorMessage(player, "การ์ดในกระเป๋าไม่พอ");
            return false;
        }

        var itemRef = new ItemReference(dustId, dust);
        var bagId = player.AddItemToInventory(itemRef);

        itemRef.Count = inventory.GetItemCount(dustId);
        CommandBuilder.AddItemToInventory(player, itemRef, bagId, dust);

        EnchantSystem.PlayEffect(player, "RefineSuccess");

        var name = DataManager.ItemList.TryGetValue(itemId, out var data) ? data.Name : itemId.ToString();
        EnchantCraftSystem.Tell(player, $"<color=#55FF55>บด {name} x{count}</color> ได้ผงการ์ด x{dust}");

        ServerLogger.Log($"[CardGrind] {player.Name} ground {count} of item {itemId}.");
        return true;
    }
}
