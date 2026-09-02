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
/// a monster changed - by asking what drops the card and whether anything ordinary does.
/// A card nothing drops is refused too, since that is a card handed out by something other
/// than hunting and grinding it is not what anybody meant.
/// </remarks>
public static class CardGrindSystem
{
    public const string DustCode = "Card_Dust";

    /// <summary>Cards a boss drops and nothing ordinary does. Built on first use.</summary>
    private static HashSet<int>? bossOnlyCards;

    /// <summary>Cards the scribe will take. A whitelist, not whatever is left over.</summary>
    private static HashSet<int>? grindableCards;

    public static int DustPerCard => 1;

    /// <summary>
    /// Sorts every card into what the scribe will and will not take, once, out of data the
    /// server already has.
    /// </summary>
    /// <remarks>
    /// Reading the drop tables rather than naming the cards means this is right by
    /// construction: move a card onto a boss and it becomes unbreakable, take it off and it
    /// does not, with nothing to remember to edit.
    ///
    /// Three rules, applied in order.
    ///
    /// A card a boss drops and no ordinary monster does is refused. Both lists are collected
    /// and the ordinary one wins, because "a boss drops it" turned out not to be the same
    /// question as "is it rare" - a Spore Card comes off a Spore at level sixteen and off a
    /// Deathspore, which is a boss, and refusing it for the second source told a player that
    /// their commonest card was too precious to grind.
    ///
    /// A card nothing drops and no box holds is refused as well. Those belong to monsters
    /// with no drop table written yet, so nobody can be holding one - and refusing them now
    /// means a boss whose drops get filled in later cannot be ground in the window before
    /// its card reaches a drop table. Five cards sit in that state today, Dark Priest and
    /// the three Valkyrie realm bosses among them.
    ///
    /// Everything else is fine. A box counts as a source, which is how a Kaho Card out of an
    /// Old Card Album grinds - but only after the first rule has already taken the Ghostring
    /// and Angeling cards out of that same album.
    /// </remarks>
    private static void SortCards()
    {
        if (grindableCards != null)
            return;

        var boss = new HashSet<int>();
        var common = new HashSet<int>();

        foreach (var (code, drops) in DataManager.MonsterDropData)
        {
            if (!DataManager.MonsterCodeLookup.TryGetValue(code, out var monster))
                continue;

            var list = monster.Special == CharacterSpecialType.Boss ? boss : common;

            foreach (var drop in drops.DropChances)
            {
                if (DataManager.ItemList.TryGetValue(drop.Id, out var item) && item.ItemClass == ItemClass.Card)
                    list.Add(drop.Id);
            }
        }

        boss.ExceptWith(common);

        var grind = new HashSet<int>(common);

        foreach (var (_, contents) in DataManager.ItemBoxSummonList)
        {
            foreach (var id in contents)
            {
                if (DataManager.ItemList.TryGetValue(id, out var item) && item.ItemClass == ItemClass.Card)
                    grind.Add(id);
            }
        }

        grind.ExceptWith(boss);

        bossOnlyCards = boss;
        grindableCards = grind;

        ServerLogger.Log($"[CardGrind] {grind.Count} card(s) can be ground, {boss.Count} come off bosses alone.");
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

        SortCards();

        if (bossOnlyCards!.Contains(itemId))
        {
            refusal = "การ์ดบอสบดไม่ได้";
            return false;
        }

        if (!grindableCards!.Contains(itemId))
        {
            refusal = "การ์ดใบนี้ไม่มีมอนธรรมดาตัวไหนดรอป บดไม่ได้";
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
