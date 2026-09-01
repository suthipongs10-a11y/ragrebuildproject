using RebuildSharedData.Data;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Simulation.Enchanting;

/// <summary>
/// The scribe actually writing one, materials and all.
/// </summary>
public static class EnchantCraftSystem
{
    /// <summary>
    /// Reads the recipe out with what the player is carrying beside it.
    /// </summary>
    /// <remarks>
    /// Said in chat rather than in the dialogue box, because the box is four lines and the
    /// sky recipe is nine ingredients. Colouring what is short in red is the whole value of
    /// this: a wall of nine lines that all look the same tells nobody what to go and hunt.
    /// </remarks>
    public static void Describe(Player player, EnchantTier tier)
    {
        if (!EnchantRecipes.CanCraft(tier))
        {
            Tell(player, "<color=#FF5555>ระดับนั้นข้ายังจารไม่ได้</color>");
            return;
        }

        var chance = EnchantRecipes.ChanceFor(player, tier) / 100f;

        Tell(player, $"<color=#FFCC55>สูตรคัมภีร์ระดับ{ThaiName(tier)}</color> — โอกาสสำเร็จของเจ้า <b>{chance:0.#}%</b>");

        foreach (var mat in EnchantRecipes.MaterialsFor(tier))
        {
            var have = CountOf(player, mat.Code);
            var enough = have >= mat.Count;
            var colour = enough ? "#55FF55" : "#FF5555";

            Tell(player, $"  <color={colour}>{EnchantRecipes.NameOf(mat.Code)} {have}/{mat.Count}</color>");
        }

        var zeny = EnchantRecipes.ZenyFor(tier);
        var hasZeny = player.GetZeny() >= zeny;
        Tell(player, $"  <color={(hasZeny ? "#55FF55" : "#FF5555")}>ค่าจ้าง {zeny:n0} zeny</color>");
        Tell(player, "<size=-3><color=#7A7480>พลาดแล้ววัตถุดิบหายหมด · ได้คัมภีร์ชนิดไหนเป็นการสุ่ม</color></size>");
    }

    /// <summary>
    /// One attempt: take everything, then roll.
    /// </summary>
    /// <remarks>
    /// Checked in full before a single thing is taken, so a player who is one jellopy short
    /// finds out while still holding all of them. Past that point the materials are gone
    /// whichever way the roll falls - that is what makes it a roll rather than a purchase.
    /// </remarks>
    public static bool TryCraft(Player player, EnchantTier tier)
    {
        if (!EnchantRecipes.CanCraft(tier))
        {
            Tell(player, "<color=#FF5555>ระดับนั้นข้ายังจารไม่ได้</color>");
            return false;
        }

        var recipe = EnchantRecipes.MaterialsFor(tier);
        var zeny = EnchantRecipes.ZenyFor(tier);

        foreach (var mat in recipe)
        {
            if (CountOf(player, mat.Code) >= mat.Count)
                continue;

            Tell(player, $"<color=#FF5555>{EnchantRecipes.NameOf(mat.Code)} ไม่พอ</color> ต้องมี {mat.Count} ชิ้น");
            return false;
        }

        if (player.GetZeny() < zeny)
        {
            Tell(player, $"<color=#FF5555>เงินไม่พอ</color> ต้องมี {zeny:n0} zeny");
            return false;
        }

        //Bag space is checked before anything is spent for the same reason the forge does
        //it: somebody who cannot carry the result should be told, not charged.
        var slot = EnchantScrolls.RollSlot();
        var code = EnchantScrolls.CodeFor(tier, slot);

        if (!DataManager.ItemIdByName.TryGetValue(code, out var scrollId))
        {
            ServerLogger.LogWarning($"[Enchant] the scribe tried to make {code}, which is not an item.");
            Tell(player, "<color=#FF5555>เกิดข้อผิดพลาด</color> บอกคนดูแลเซิร์ฟเวอร์ด้วย");
            return false;
        }

        if (!player.CanPickUpItem(new ItemReference(scrollId, 1)))
        {
            Tell(player, "<color=#FF5555>กระเป๋าเต็ม</color> เอาของออกก่อน");
            return false;
        }

        foreach (var mat in recipe)
            TakeAll(player, mat.Code, mat.Count);

        player.DropZeny(zeny);
        CommandBuilder.SendUpdateZeny(player);

        if (!EnchantRecipes.Roll(player, tier))
        {
            EnchantSystem.PlayEffect(player, "RefineFailure");
            Tell(player, $"<color=#FF5555>จารไม่ติด</color> กระดาษไหม้ไปทั้งแผ่น วัตถุดิบหายหมด");
            return false;
        }

        var itemRef = new ItemReference(scrollId, 1);
        var bagId = player.AddItemToInventory(itemRef);

        itemRef.Count = player.Inventory?.GetItemCount(scrollId) ?? 1;
        CommandBuilder.AddItemToInventory(player, itemRef, bagId, 1);

        EnchantSystem.PlayEffect(player, "RefineSuccess");
        if (tier >= EnchantTier.Heaven)
            EnchantSystem.PlayEffect(player, "LevelUp");

        var name = DataManager.ItemList.TryGetValue(scrollId, out var data) ? data.Name : code;
        Tell(player, $"<color=#55FF55>จารสำเร็จ</color> ได้ {name}");
        Tell(player, $"<size=-3><color=#7A7480>สุ่มได้ชนิด {EnchantScrolls.NameOf(slot)} · โอกาส {EnchantScrolls.WeightOf(slot)}%</color></size>");

        ServerLogger.Log($"[Enchant] {player.Name} crafted a {tier} {slot} scroll.");
        return true;
    }

    /// <summary>The clearing scroll's recipe, read out the same way.</summary>
    public static void DescribeBlank(Player player)
    {
        Tell(player, "<color=#FFCC55>สูตรคัมภีร์ล้างออพ</color> — <b>สำเร็จเสมอ ไม่มีพลาด</b>");

        foreach (var mat in EnchantRecipes.BlankRecipe)
        {
            var have = CountOf(player, mat.Code);
            var colour = have >= mat.Count ? "#55FF55" : "#FF5555";
            Tell(player, $"  <color={colour}>{EnchantRecipes.NameOf(mat.Code)} {have}/{mat.Count}</color>");
        }

        var hasZeny = player.GetZeny() >= EnchantRecipes.BlankZenyCost;
        Tell(player, $"  <color={(hasZeny ? "#55FF55" : "#FF5555")}>ค่าจ้าง {EnchantRecipes.BlankZenyCost:n0} zeny</color>");
        Tell(player, "<size=-3><color=#7A7480>ใช้ล้างออพเดิมออก แล้วถึงจะจารใหม่ได้</color></size>");
    }

    /// <summary>
    /// One clearing scroll. Costs a great deal and always works.
    /// </summary>
    public static bool TryCraftBlank(Player player)
    {
        var recipe = EnchantRecipes.BlankRecipe;

        foreach (var mat in recipe)
        {
            if (CountOf(player, mat.Code) >= mat.Count)
                continue;

            Tell(player, $"<color=#FF5555>{EnchantRecipes.NameOf(mat.Code)} ไม่พอ</color> ต้องมี {mat.Count} ชิ้น");
            return false;
        }

        if (player.GetZeny() < EnchantRecipes.BlankZenyCost)
        {
            Tell(player, $"<color=#FF5555>เงินไม่พอ</color> ต้องมี {EnchantRecipes.BlankZenyCost:n0} zeny");
            return false;
        }

        if (!DataManager.ItemIdByName.TryGetValue(EnchantScrolls.BlankScrollCode, out var scrollId))
        {
            ServerLogger.LogWarning($"[Enchant] there is no item called '{EnchantScrolls.BlankScrollCode}'.");
            return false;
        }

        if (!player.CanPickUpItem(new ItemReference(scrollId, 1)))
        {
            Tell(player, "<color=#FF5555>กระเป๋าเต็ม</color> เอาของออกก่อน");
            return false;
        }

        foreach (var mat in recipe)
            TakeAll(player, mat.Code, mat.Count);

        player.DropZeny(EnchantRecipes.BlankZenyCost);
        CommandBuilder.SendUpdateZeny(player);

        var itemRef = new ItemReference(scrollId, 1);
        var bagId = player.AddItemToInventory(itemRef);

        itemRef.Count = player.Inventory?.GetItemCount(scrollId) ?? 1;
        CommandBuilder.AddItemToInventory(player, itemRef, bagId, 1);

        EnchantSystem.PlayEffect(player, "Magnificat");

        var name = DataManager.ItemList.TryGetValue(scrollId, out var data) ? data.Name : EnchantScrolls.BlankScrollCode;
        Tell(player, $"<color=#55FF55>ได้ {name}</color>");

        ServerLogger.Log($"[Enchant] {player.Name} crafted a blank scroll.");
        return true;
    }

    private static int CountOf(Player player, string code) =>
        DataManager.ItemIdByName.TryGetValue(code, out var id)
            ? player.Inventory?.GetItemCount(id) ?? 0
            : 0;

    private static void TakeAll(Player player, string code, int count)
    {
        if (!DataManager.ItemIdByName.TryGetValue(code, out var id))
            return;

        player.TryRemoveItemFromInventory(id, count, true);
    }

    private static string ThaiName(EnchantTier tier) => tier switch
    {
        EnchantTier.Earth => "ดิน",
        EnchantTier.Sky => "ฟ้า",
        EnchantTier.Heaven => "สวรรค์",
        EnchantTier.Legend => "ตำนาน",
        _ => tier.ToString()
    };

    internal static void Tell(Player player, string message)
    {
        if (player.Connection == null)
            return;

        CommandBuilder.AddRecipient(player.Connection);
        CommandBuilder.SendServerMessage(message, "");
        CommandBuilder.ClearRecipients();
    }
}
