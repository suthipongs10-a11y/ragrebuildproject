using System.Diagnostics;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RebuildSharedData.Util;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents.Character;
using RoRebuildServer.Data.CsvDataTypes;
using RoRebuildServer.Data.Player;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Crafting;
using RoRebuildServer.Simulation.Enchanting;
using RoRebuildServer.Simulation.StatusEffects.Setup;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.EntityComponents.Items;

public struct EquipStatChange : IEquatable<EquipStatChange>
{
    public int Value;
    public int Change;
    public CharacterStat Stat;
    public int Slot;

    public bool Equals(EquipStatChange other)
    {
        return Stat == other.Stat && Slot == other.Slot;
    }

    public override bool Equals(object? obj)
    {
        return obj is EquipStatChange other && Equals(other);
    }

    public override int GetHashCode()
    {
        return HashCode.Combine((int)Stat, Change);
    }
}

public struct AutoSpellEffect
{
    public CharacterSkill Skill;
    public SkillPreferredTarget Target;
    public int Level;
    public int Chance;
}

/// <summary>
/// A card's "chance to find something when you kill something". Thirteen cards were
/// shipped with an empty effect block and a comment describing one of these, so it is
/// one feature rather than thirteen.
///
/// Race is nullable because most of them apply to anything; the ones that do not name a
/// single race. ItemIds is a list because several cards offer a choice — a gemstone of
/// any colour, one of three juices — and the roll picks one of them, which is what the
/// printed description of those cards says happens.
/// </summary>
public struct BonusDropEffect
{
    public int[] ItemIds;
    public CharacterRace? Race;
    public int Chance; //per mille, matching the autospells
}

public struct WeaponAttackInfo
{
    public WeaponInfo? WeaponInfo;
    public AttackElement OverrideElement;
    public int MinRefineAtkBonus;
    public int MaxRefineAtkBonus;

    public int WeaponClass => WeaponInfo?.WeaponClass ?? 0;
    public int WeaponAttackPower => WeaponInfo?.Attack ?? 0;
    public int WeaponLevel => WeaponInfo?.WeaponLevel ?? 0;

    public AttackElement WeaponElement
    {
        get
        {
            if (OverrideElement != AttackElement.None)
                return OverrideElement;
            return WeaponInfo?.Element ?? AttackElement.Neutral;
        }
    }

    public WeaponAttackInfo() => Reset();

    public WeaponAttackInfo(WeaponInfo info, int minRefineAtkBonus, int maxRefineAtkBonus)
    {
        WeaponInfo = info;
        MinRefineAtkBonus = minRefineAtkBonus;
        MaxRefineAtkBonus = maxRefineAtkBonus;
        OverrideElement = AttackElement.None;
    }

    public void Reset()
    {
        WeaponInfo = null;
        MinRefineAtkBonus = 0;
        MaxRefineAtkBonus = 0;
        OverrideElement = AttackElement.None;
    }
}

public class ItemEquipState
{
    public Player Player = null!; //this is set in player init
    public readonly int[] ItemSlots = new int[10];
    public readonly int[] ItemIds = new int[10];
    public int AmmoId;
    public AmmoType AmmoType;
    public int AmmoAttackPower;
    public bool IsDualWielding => OffHandWeapon.WeaponClass > 0;
    public int DoubleAttackModifiers;
    public int WeaponRange;
    public AttackElement AmmoElement;
    public CharacterElement ArmorElement;
    public WeaponAttackInfo MainHandWeapon;
    public WeaponAttackInfo OffHandWeapon;
    public Dictionary<string, int> ActiveItemCombos = new();
    public Dictionary<int, int> EquippedItems = new();
    public Dictionary<int, AutoSpellEffect> AutoSpellSkillsOnAttack = new();
    public Dictionary<int, AutoSpellEffect> AutoSpellSkillsWhenAttacked = new();
    public Dictionary<int, BonusDropEffect> BonusDropsOnKill = new();
    public Dictionary<int, BonusDropEffect> BonusZenyOnKill = new();
    private readonly SwapList<EquipStatChange> equipmentEffects = new();
    private int activeSlotId;
    private bool isOffHand;
    private readonly HeadgearPosition[] headgearMultiSlotInfo = new HeadgearPosition[3];
    private bool isTwoHandedWeapon;
    private static int[] attackPerRefine = [2, 3, 5, 7];
    private static int[] overRefineLevel = [7, 6, 5, 4];
    private static int[] overRefineAttackBonus = [3, 5, 8, 14];
    private int nextId = 0;
    private int nextComboSlotId = 100;

    public void Reset()
    {
        for (var i = 0; i < ItemSlots.Length; i++)
            ItemSlots[i] = 0;
        for (var i = 0; i < 3; i++)
            headgearMultiSlotInfo[i] = 0;
        AmmoId = -1;
        WeaponRange = 1;
        MainHandWeapon.Reset();
        OffHandWeapon.Reset();
        ArmorElement = CharacterElement.Neutral1;
        AmmoElement = AttackElement.None;
        AutoSpellSkillsOnAttack.Clear();
        AutoSpellSkillsWhenAttacked.Clear();
        BonusDropsOnKill.Clear();
        BonusZenyOnKill.Clear();
        equipmentEffects.Clear();
        EquippedItems.Clear();
        ActiveItemCombos.Clear();
        nextId = 0;
    }

    public int GetEquipmentIdBySlot(EquipSlot slot) => ItemIds[(int)slot];

    public bool IsItemEquipped(int bagId)
    {
        for (var i = 0; i < 10; i++)
            if (ItemSlots[i] == bagId)
                return true;
        return false;
    }


    public bool IsItemIdEquipped(int itemId)
    {
        if (AmmoId == itemId)
            return true;
        for (var i = 0; i < 10; i++)
            if (ItemIds[i] == itemId)
                return true;
        return false;
    }

    public EquipSlot GetOccupiedSlotForItem(int bagId)
    {
        for (var i = 0; i < 10; i++)
            if (ItemSlots[i] == bagId)
                return (EquipSlot)i;
        return EquipSlot.None;
    }

    public void UnequipAllItems()
    {
        for (var i = 0; i < 10; i++)
        {
            if (ItemSlots[i] <= 0)
                continue;

            UnEquipEvent((EquipSlot)i);
            CommandBuilder.PlayerEquipItem(Player, ItemSlots[i], (EquipSlot)i, false);

            ItemSlots[i] = -1;
            ItemIds[i] = -1;
            isTwoHandedWeapon = false;
        }

        for (var i = 0; i < 3; i++)
            headgearMultiSlotInfo[i] = HeadgearPosition.None;

        MainHandWeapon.Reset();
        OffHandWeapon.Reset();
        RemoveEquipEffectForAmmo();
        AmmoId = -1;
        WeaponRange = 1;
    }

    public void UpdateAppearanceIfNecessary(EquipSlot slot)
    {
        switch (slot)
        {
            case EquipSlot.HeadTop:
            case EquipSlot.HeadBottom:
            case EquipSlot.HeadMid:
            case EquipSlot.Weapon:
            case EquipSlot.Shield:
                CommandBuilder.UpdatePlayerAppearanceAuto(Player);
                break;
        }
    }

    public void UnEquipItem(int bagId)
    {
        if (Player.Inventory == null || !Player.Inventory.GetItem(bagId, out var item))
            return;

        var itemData = DataManager.ItemList[item.Id];
        var updateAppearance = false;

        if (itemData.ItemClass == ItemClass.Ammo)
        {
            RemoveEquipEffectForAmmo();
            AmmoId = -1;
            AmmoAttackPower = 0;
            AmmoElement = AttackElement.None;
            CommandBuilder.PlayerEquipItem(Player, bagId, EquipSlot.Ammunition, false);
            return;
        }

        if (itemData.ItemClass == ItemClass.Weapon)
        {
            var slot = EquipSlot.Weapon;
            if (ItemSlots[(int)EquipSlot.Shield] == bagId)
                slot = EquipSlot.Shield;
            UnEquipItem(slot);
            updateAppearance = true;
            WeaponRange = 1;
        }
        else
        {
            var equipInfo = DataManager.ArmorInfo[item.Id];
            if (equipInfo.EquipPosition.HasFlag(EquipPosition.Headgear))
            {
                if (equipInfo.HeadPosition.HasFlag(HeadgearPosition.Top)) UnEquipItem(EquipSlot.HeadTop);
                if (equipInfo.HeadPosition.HasFlag(HeadgearPosition.Mid)) UnEquipItem(EquipSlot.HeadMid);
                if (equipInfo.HeadPosition.HasFlag(HeadgearPosition.Bottom)) UnEquipItem(EquipSlot.HeadBottom);
                updateAppearance = true;
            }

            if (equipInfo.EquipPosition.HasFlag(EquipPosition.Shield))
            {
                UnEquipItem(EquipSlot.Shield);
                updateAppearance = true;
            }

            if (equipInfo.EquipPosition.HasFlag(EquipPosition.Armor)) UnEquipItem(EquipSlot.Body);
            if (equipInfo.EquipPosition.HasFlag(EquipPosition.Garment)) UnEquipItem(EquipSlot.Garment);
            if (equipInfo.EquipPosition.HasFlag(EquipPosition.Boots)) UnEquipItem(EquipSlot.Footgear);
            if (equipInfo.EquipPosition.HasFlag(EquipPosition.Accessory))
            {
                if (ItemSlots[(int)EquipSlot.Accessory1] == bagId) UnEquipItem(EquipSlot.Accessory1);
                if (ItemSlots[(int)EquipSlot.Accessory2] == bagId) UnEquipItem(EquipSlot.Accessory2);
            }
        }

        if (Player.CombatEntity.TryGetStatusContainer(out var status))
            status.OnChangeEquipment();
        if (updateAppearance)
            CommandBuilder.UpdatePlayerAppearanceAuto(Player);
        Player.UpdateStats();
    }

    private void UnEquipItem(EquipSlot slot)
    {
        var bagId = ItemSlots[(int)slot];
        if (bagId <= 0)
            return;

        UnEquipEvent(slot);
        ItemSlots[(int)slot] = 0;
        ItemIds[(int)slot] = 0;
        CommandBuilder.PlayerEquipItem(Player, bagId, slot, false);
        if (slot == EquipSlot.Weapon)
        {
            isTwoHandedWeapon = false;
            WeaponRange = 1;
        }

        if (slot == EquipSlot.HeadTop || slot == EquipSlot.HeadMid || slot == EquipSlot.HeadBottom)
            headgearMultiSlotInfo[(int)slot] = HeadgearPosition.None;
    }

    private EquipSlot EquipSlotForWeapon(WeaponInfo weapon)
    {
        //if an assassin is using a one-handed weapon and they are currently equipped with one weapon and no shield, place in shield slot
        if (Player.Character.ClassId == 11 && !isTwoHandedWeapon && !weapon.IsTwoHanded && ItemSlots[(int)EquipSlot.Weapon] > 0 &&
            ItemSlots[(int)EquipSlot.Shield] == 0)
            return EquipSlot.Shield;
        return EquipSlot.Weapon;
    }

    private EquipSlot EquipSlotForEquipment(ArmorInfo info, int itemId)
    {
        if ((info.EquipPosition & EquipPosition.Headgear) != 0)
        {
            if (info.HeadPosition.HasFlag(HeadgearPosition.Top)) return EquipSlot.HeadTop;
            if (info.HeadPosition.HasFlag(HeadgearPosition.Mid)) return EquipSlot.HeadMid;
            if (info.HeadPosition.HasFlag(HeadgearPosition.Bottom)) return EquipSlot.HeadBottom;
        }

        if (info.EquipPosition.HasFlag(EquipPosition.Body)) return EquipSlot.Body;
        if (info.EquipPosition.HasFlag(EquipPosition.Garment)) return EquipSlot.Garment;
        if (info.EquipPosition.HasFlag(EquipPosition.Shield)) return EquipSlot.Shield;
        if (info.EquipPosition.HasFlag(EquipPosition.Boots)) return EquipSlot.Footgear;
        if (info.EquipPosition.HasFlag(EquipPosition.Accessory))
            if (ItemSlots[(int)EquipSlot.Accessory1] > 0 && ItemSlots[(int)EquipSlot.Accessory2] <= 0)
                return EquipSlot.Accessory2;
            else
                return EquipSlot.Accessory1;

        throw new Exception($"Invalid equipment position for item {itemId}!");
    }

    private bool IsValidSlotForEquipment(ArmorInfo info, EquipSlot slot)
    {
        return slot switch
        {
            EquipSlot.HeadTop => (info.EquipPosition & EquipPosition.Headgear) > 0 && info.HeadPosition.HasFlag(HeadSlots.Top),
            EquipSlot.HeadMid => (info.EquipPosition & EquipPosition.Headgear) > 0 && info.HeadPosition.HasFlag(HeadSlots.Mid),
            EquipSlot.HeadBottom => (info.EquipPosition & EquipPosition.Headgear) > 0 && info.HeadPosition.HasFlag(HeadSlots.Bottom),
            EquipSlot.Weapon => false,
            EquipSlot.Shield => info.EquipPosition.HasFlag(EquipPosition.Shield),
            EquipSlot.Body => info.EquipPosition.HasFlag(EquipPosition.Armor),
            EquipSlot.Garment => info.EquipPosition.HasFlag(EquipPosition.Garment),
            EquipSlot.Footgear => info.EquipPosition.HasFlag(EquipPosition.Footgear),
            EquipSlot.Accessory1 => info.EquipPosition.HasFlag(EquipPosition.Accessory),
            EquipSlot.Accessory2 => info.EquipPosition.HasFlag(EquipPosition.Accessory),
            _ => false
        };
    }

    private EquipChangeResult EquipWeapon(int bagId, EquipSlot equipSlot, ItemInfo itemData)
    {
        var weaponInfo = DataManager.WeaponInfo[itemData.Id];

        if (equipSlot == EquipSlot.None)
            equipSlot = EquipSlotForWeapon(weaponInfo);

        if (equipSlot != EquipSlot.Weapon && equipSlot != EquipSlot.Shield)
            return EquipChangeResult.InvalidItem;

        if (Player.GetStat(CharacterStat.Level) < weaponInfo.MinLvl)
            return EquipChangeResult.LevelTooLow;

        if (!DataManager.IsJobInEquipGroup(weaponInfo.EquipGroup, Player.Character.ClassId))
            return EquipChangeResult.NotApplicableJob;

        if (equipSlot == EquipSlot.Shield && Player.Character.ClassId != 11 && !weaponInfo.IsTwoHanded)
            return EquipChangeResult.InvalidItem;

        //make sure they don't equip the same weapon in both hands
        if ((equipSlot == EquipSlot.Shield && ItemSlots[(int)EquipSlot.Weapon] == bagId)
            || (equipSlot == EquipSlot.Weapon && ItemSlots[(int)EquipSlot.Shield] == bagId))
            return EquipChangeResult.InvalidItem;

        if (weaponInfo.IsTwoHanded)
            UnEquipItem(EquipSlot.Shield);

        UnEquipItem(equipSlot);

        if (equipSlot == EquipSlot.Weapon)
            isTwoHandedWeapon = weaponInfo.IsTwoHanded;

        ItemSlots[(int)equipSlot] = bagId;
        ItemIds[(int)equipSlot] = itemData.Id;

        OnEquipEvent(equipSlot);
        CommandBuilder.UpdatePlayerAppearanceAuto(Player);

        if (Player.CombatEntity.TryGetStatusContainer(out var status))
            status.OnChangeEquipment();

        CommandBuilder.PlayerEquipItem(Player, bagId, equipSlot, true);

        return EquipChangeResult.Success;
    }

    public EquipChangeResult EquipArmorOrAccessory(int bagId, EquipSlot equipSlot, ItemInfo itemData)
    {
        var equipInfo = DataManager.ArmorInfo[itemData.Id];
        if (Player.GetStat(CharacterStat.Level) < equipInfo.MinLvl)
            return EquipChangeResult.LevelTooLow;

        if (!DataManager.IsJobInEquipGroup(equipInfo.EquipGroup, Player.Character.ClassId))
            return EquipChangeResult.NotApplicableJob;


        if (equipSlot == EquipSlot.None || equipInfo.EquipPosition == EquipPosition.Headgear)
            equipSlot = EquipSlotForEquipment(equipInfo, itemData.Id);
        else if (!IsValidSlotForEquipment(equipInfo, equipSlot))
            return EquipChangeResult.InvalidPosition;

        //make sure they don't equip the same accessory in both slots
        if (equipSlot == EquipSlot.Accessory1)
        {
            if (ItemSlots[(int)EquipSlot.Accessory2] == bagId)
                return EquipChangeResult.InvalidItem;
        }
        else if (equipSlot == EquipSlot.Accessory2)
        {
            if (ItemSlots[(int)EquipSlot.Accessory1] == bagId)
                return EquipChangeResult.InvalidItem;
        }

        if (equipInfo.EquipPosition == EquipPosition.Shield && isTwoHandedWeapon)
            UnEquipItem(EquipSlot.Weapon);

        UnEquipItem(equipSlot);

        if (equipInfo.EquipPosition == EquipPosition.Headgear)
        {
            for (var i = 0; i < 3; i++)
            {
                //if any of the other headgear block this slot, we'll need to unequip them as well
                if ((equipInfo.HeadPosition & headgearMultiSlotInfo[i]) > 0)
                    UnEquipItem((EquipSlot)i);
            }

            headgearMultiSlotInfo[(int)equipSlot] = equipInfo.HeadPosition;
        }

        ItemSlots[(int)equipSlot] = bagId;
        ItemIds[(int)equipSlot] = itemData.Id;

        OnEquipEvent(equipSlot);
        CommandBuilder.UpdatePlayerAppearanceAuto(Player);

        if (Player.CombatEntity.TryGetStatusContainer(out var status))
            status.OnChangeEquipment();

        CommandBuilder.PlayerEquipItem(Player, bagId, equipSlot, true);

        return EquipChangeResult.Success;
    }

    public EquipChangeResult EquipItem(int bagId, EquipSlot equipSlot = EquipSlot.None)
    {
        if (Player.Inventory == null || !Player.Inventory.GetItem(bagId, out var item))
            return EquipChangeResult.InvalidItem;

        var itemData = DataManager.ItemList[item.Id];

        if (itemData.ItemClass == ItemClass.Ammo)
            return EquipAmmo(item.Id) ? EquipChangeResult.Success : EquipChangeResult.InvalidItem;

        if (IsItemEquipped(bagId))
            return EquipChangeResult.AlreadyEquipped;

        if (itemData.ItemClass == ItemClass.Weapon)
            return EquipWeapon(bagId, equipSlot, itemData);

        if (itemData.ItemClass == ItemClass.Equipment)
            return EquipArmorOrAccessory(bagId, equipSlot, itemData);

        return EquipChangeResult.InvalidItem;
    }

    private void RemoveEquipEffectForAmmo()
    {
        if (!DataManager.ItemList.TryGetValue(AmmoId, out var unEquipInfo))
            return;

        for (var i = 0; i < equipmentEffects.Count; i++)
        {
            var effect = equipmentEffects[i];
            if (effect.Slot == (int)EquipSlot.Ammunition)
            {
                ReverseEquipmentEffect(effect);
                equipmentEffects.Remove(i);
                i--; //we've moved the last element into our current position, so we step the enumerator back by 1
            }
        }

        SubEquipItemCount(AmmoId);

        unEquipInfo.Interaction?.OnUnequip(Player, Player.CombatEntity, this, new UniqueItem(),
            EquipSlot.Ammunition);
        OnUnEquipUpdateItemSets(AmmoId);
    }

    public bool EquipAmmo(int ammoId, bool isPlayerActive = true, bool unEquipExisting = true, bool forceUpdate = false)
    {
        if (AmmoId == ammoId && !forceUpdate)
            return true;

        if (!DataManager.AmmoInfo.TryGetValue(ammoId, out var ammo))
            return false;

        //player can be null here if we're deserializing on character load. In that case, the OnEquip event will be sent from RunEquipAll
        if (isPlayerActive && unEquipExisting)
            RemoveEquipEffectForAmmo();

        AmmoId = ammoId;
        AmmoType = ammo.Type;
        AmmoAttackPower = ammo.Attack;
        AmmoElement = ammo.Element;

        if (isPlayerActive)
        {
            AddEquipItemCount(AmmoId);
            CommandBuilder.PlayerEquipItem(Player, ammoId, EquipSlot.Ammunition, true);
            if (DataManager.ItemList.TryGetValue(ammoId, out var equipInfo))
                equipInfo.Interaction?.OnEquip(Player, Player.CombatEntity, this, new UniqueItem(), EquipSlot.Ammunition);
            OnEquipUpdateItemSets(AmmoId);
        }

        return true;
    }

    private void OnEquipEvent(EquipSlot slot)
    {
        Debug.Assert(Player.Inventory != null);

        if (slot == EquipSlot.None || ItemSlots[(int)slot] <= 0)
            return;

        activeSlotId = (int)slot;
        var bagId = ItemSlots[(int)slot];
        var item = Player.Inventory.UniqueItems[bagId];
        if (!DataManager.ItemList.TryGetValue(item.Id, out var data))
        {
            ServerLogger.LogWarning($"Player {Player.Character.Name} has an itemId {item} equipped but we don't have such an item in our item database.");
            return;
        }

        if (data.ItemClass == ItemClass.Weapon)
        {
            isOffHand = slot == EquipSlot.Shield;
            if (!DataManager.WeaponInfo.TryGetValue(item.Id, out var weapon))
            {
                Player.SetStat(CharacterStat.Attack, 0);
                Player.SetStat(CharacterStat.Attack2, 0);
                Player.RefreshWeaponMastery();
                MainHandWeapon.Reset();
                WeaponRange = 1;
            }
            else
            {
                var wLvl = weapon.WeaponLevel - 1;

                var refBonus = item.Refine * attackPerRefine[wLvl];
                var overRefBonus = 0;
                var overRefine = item.Refine - overRefineLevel[wLvl];
                if (overRefine > 0)
                    overRefBonus = overRefine * overRefineAttackBonus[wLvl];

                //Star crumbs forged into the weapon, counted here rather than left to the
                //slot effects below: five each is easy enough for an effect to hand out, but
                //the third crumb is worth thirty on its own and an effect fired once per
                //slot cannot see how many of it there are.
                refBonus += ForgeSystem.StarCrumbAttackBonus(CountSlotItem(ref item, StarCrumbId), weapon.Attack);

                //And what the smith's name is worth. Kept beside the crumbs because it is
                //the same kind of thing - attack the weapon has because of how it was made
                //rather than because of what it is - and because both have to be in the
                //refine bonus to be multiplied by a skill the way weapon attack is.
                refBonus += ForgeFame.AttackBonusForRank(ForgedItemRegistry.RankFor(item.UniqueId));

                var weaponInfo = new WeaponAttackInfo(weapon, refBonus, refBonus + overRefBonus);

                if (slot == EquipSlot.Weapon)
                {
                    MainHandWeapon = weaponInfo;
                    WeaponRange = weapon.Range;
                }

                if (slot == EquipSlot.Shield)
                    OffHandWeapon = weaponInfo;

                isTwoHandedWeapon = weapon.IsTwoHanded;

                Player.SetStat(CharacterStat.Attack, 0);
                Player.SetStat(CharacterStat.Attack2, 0);
                Player.RefreshWeaponMastery();
            }
        }

        if (data.ItemClass == ItemClass.Equipment)
        {
            if (DataManager.ArmorInfo.TryGetValue(item.Id, out var armor))
            {
                Player.AddStat(CharacterStat.Def, armor.Defense);
                Player.AddStat(CharacterStat.MDef, armor.MagicDefense);

                if (armor.IsRefinable)
                    Player.AddStat(CharacterStat.EquipmentRefineDef, item.Refine);

                if (armor.EquipPosition == EquipPosition.Body)
                    ArmorElement = armor.Element;
            }
        }

        AddEquipItemCount(item.Id);

        data.Interaction?.OnEquip(Player, Player.CombatEntity, this, item, slot);

        //Enchant options, applied through AddStat like anything else an item grants. That
        //is the whole reason they go here rather than anywhere more convenient: AddStat
        //records the change against activeSlotId, which is this slot, so taking the item
        //off takes the options off with it and nothing has to remember to undo them.
        if (EnchantRegistry.TryGet(item.UniqueId, out var enchant))
        {
            for (var e = 0; e < enchant.Count; e++)
                AddStat(enchant.Options[e].Stat, enchant.Options[e].Value);
        }

        for (var j = 0; j < 4; j++)
        {
            unsafe //all this trouble to ensure all 4 slots are always allocated in sequence in the struct
            {
                var slotItem = item.Data[j];
                if (slotItem <= 0)
                    continue;
                if (!DataManager.ItemList.TryGetValue(slotItem, out var slotData))
                    throw new Exception($"Attempting to run RunAllOnEquip event for item {slotItem} (socketed in a {item.Id}), but it doesn't appear to exist in the item database.");

                AddEquipItemCount(slotData.Id);
                slotData.Interaction?.OnEquip(Player, Player.CombatEntity, this, default, slot);
                OnEquipUpdateItemSets(slotData.Id);
            }
        }

        OnEquipUpdateItemSets(item.Id);
    }

    /// <summary>
    /// Star Crumb's item id, looked up once.
    ///
    /// Held rather than looked up per equip because equipping happens on every stat
    /// refresh, and this is a dictionary hit on a string that never changes.
    /// </summary>
    private static int starCrumbId = -1;

    private static int StarCrumbId
    {
        get
        {
            if (starCrumbId < 0)
                starCrumbId = DataManager.ItemIdByName.GetValueOrDefault("Star_Crumb", 0);
            return starCrumbId;
        }
    }

    /// <summary>How many of one thing are socketed into an item.</summary>
    private static int CountSlotItem(ref UniqueItem item, int itemId)
    {
        if (itemId <= 0)
            return 0;

        var count = 0;
        for (var i = 0; i < 4; i++)
            if (item.SlotData(i) == itemId)
                count++;

        return count;
    }

    private void AddEquipItemCount(int itemId)
    {
        if (EquippedItems.TryGetValue(itemId, out var equipCount))
            EquippedItems[itemId] = equipCount + 1;
        else
            EquippedItems.Add(itemId, 1);
    }

    private void SubEquipItemCount(int itemId)
    {
        if (EquippedItems.TryGetValue(itemId, out var equipCount))
        {
            if (equipCount > 1)
                EquippedItems[itemId] = equipCount - 1;
            else
                EquippedItems.Remove(itemId);
        }
        else
            ServerLogger.LogWarning($"Attempting to perform SubEquipItemCount for itemId {itemId}, but we don't think that item is currently equipped.");
    }

    public void PerformOnEquipForNewCard(ItemInfo item, EquipSlot slot)
    {
        activeSlotId = (int)slot;
        isOffHand = slot == EquipSlot.Shield;
        AddEquipItemCount(item.Id);
        item.Interaction?.OnEquip(Player, Player.CombatEntity, this, default, slot);
        OnEquipUpdateItemSets(item.Id);
    }

    private void UnEquipEvent(EquipSlot slot)
    {
        Debug.Assert(Player.Inventory != null);

        if (ItemSlots[(int)slot] <= 0)
            return;

        activeSlotId = (int)slot;
        var bagId = ItemSlots[(int)slot];
        var item = Player.Inventory.UniqueItems[bagId];
        if (!DataManager.ItemList.TryGetValue(item.Id, out var data))
            throw new Exception($"Attempting to run RunAllOnEquip event for item {item.Id}, but it doesn't appear to exist in the item database.");

        if (data.ItemClass == ItemClass.Weapon)
        {
            isOffHand = slot == EquipSlot.Shield;
            switch (slot)
            {
                case EquipSlot.Weapon:
                    MainHandWeapon.Reset();
                    break;
                case EquipSlot.Shield:
                    OffHandWeapon.Reset();
                    break;
                default:
                    ServerLogger.LogErrorWithStackTrace($"Attempting to UnEquipEvent a weapon in an unexpected slot ({slot})!");
                    break;
            }

            Player.RefreshWeaponMastery();
        }

        if (data.ItemClass == ItemClass.Equipment)
        {
            if (DataManager.ArmorInfo.TryGetValue(item.Id, out var armor))
            {
                Player.SubStat(CharacterStat.Def, armor.Defense);
                Player.SubStat(CharacterStat.MDef, armor.MagicDefense);

                if (armor.IsRefinable)
                    Player.SubStat(CharacterStat.EquipmentRefineDef, item.Refine);

                if (armor.EquipPosition == EquipPosition.Body)
                    ArmorElement = CharacterElement.Neutral1;
            }
        }

        SubEquipItemCount(item.Id);
        data.Interaction?.OnUnequip(Player, Player.CombatEntity, this, item, slot);
        for (var j = 0; j < 4; j++)
        {
            unsafe //all this trouble to ensure all 4 slots are always allocated in sequence in the struct
            {
                var slotItem = item.Data[j];
                if (slotItem <= 0)
                    continue;

                if (!DataManager.ItemList.TryGetValue(slotItem, out var slotData))
                    throw new Exception($"Attempting to run RunAllOnEquip event for item {item.Id} (socketed in a {item.Id}), but it doesn't appear to exist in the item database.");
                ;

                SubEquipItemCount(slotData.Id);
                slotData.Interaction?.OnUnequip(Player, Player.CombatEntity, this, default, slot);
                OnUnEquipUpdateItemSets(slotData.Id);
            }
        }

        ReverseEquipEffectsForSlot((int)slot);
        OnUnEquipUpdateItemSets(item.Id);
    }

    private void ReverseEquipEffectsForSlot(int slot)
    {
        var removedGrantedSkill = false;
        //remove saved item effects from the player
        for (var i = 0; i < equipmentEffects.Count; i++)
        {
            var effect = equipmentEffects[i];
            if (effect.Slot == slot)
            {
                removedGrantedSkill = ReverseEquipmentEffect(effect);
                equipmentEffects.Remove(i);
                i--; //we've moved the last element into our current position, so we step the enumerator back by 1
            }
        }

        if (removedGrantedSkill)
            CommandBuilder.RefreshGrantedSkills(Player);
    }

    private bool ReverseEquipmentEffect(EquipStatChange effect)
    {
        switch (effect.Stat)
        {
            case CharacterStat.SkillValue:
                Player.RemoveGrantedSkill((CharacterSkill)effect.Value, effect.Change);
                return true;
            case CharacterStat.AutoSpellOnAttacking:
                AutoSpellSkillsOnAttack.Remove(effect.Change);
                return false;
            case CharacterStat.AutoSpellWhenAttacked:
                AutoSpellSkillsWhenAttacked.Remove(effect.Change);
                return false;
            case CharacterStat.BonusDropOnKill:
                BonusDropsOnKill.Remove(effect.Change);
                return false;
            case CharacterStat.BonusZenyOnKill:
                BonusZenyOnKill.Remove(effect.Change);
                return false;
            case CharacterStat.DamageVsTag:
                if (Player.AttackVersusTag != null &&
                    Player.AttackVersusTag.TryGetValue(effect.Value, out var existingAttack))
                {
                    var newVal = existingAttack - effect.Change;
                    if (newVal == 0)
                        Player.AttackVersusTag.Remove(effect.Value);
                    else
                        Player.AttackVersusTag[effect.Value] = newVal;
                }

                return false;
            case CharacterStat.ResistVsTag:
                if (Player.ResistVersusTag != null &&
                    Player.ResistVersusTag.TryGetValue(effect.Value, out var existingResist))
                {
                    var newVal = existingResist - effect.Change;
                    if (newVal == 0)
                        Player.ResistVersusTag.Remove(effect.Value);
                    else
                        Player.ResistVersusTag[effect.Value] = newVal;
                }

                return false;
            case CharacterStat.DoubleAttackChance:
                DoubleAttackModifiers--;
                goto default;
            default:
                Player.CombatEntity.SubStat(effect.Stat, effect.Change);
                return false;
        }
    }

    private bool IsComboPrereqsMet(string comboName, int curItem = -1)
    {
        var itemsInSet = DataManager.ItemsInCombo[comboName];

        foreach (var item in itemsInSet)
        {
            if (item == curItem)
                continue;

            if (!EquippedItems.ContainsKey(item))
                return false;
        }

        return true;
    }

    private void OnEquipUpdateItemSets(int itemId)
    {
        if (!DataManager.CombosForEquipmentItem.TryGetValue(itemId, out var comboNameList))
            return;

        var oldActiveSlot = activeSlotId; //don't want to cause issues if we call OnEquipUpdateItemSets on cards

        foreach (var comboName in comboNameList)
        {
            if (ActiveItemCombos.ContainsKey(comboName))
                continue;

            if (!IsComboPrereqsMet(comboName, itemId))
                continue;

            activeSlotId = nextComboSlotId;
            DataManager.EquipmentComboInteractions[comboName].OnEquip(Player, Player.CombatEntity, this, default, EquipSlot.None);

            ActiveItemCombos.Add(comboName, nextComboSlotId);
            nextComboSlotId++;
        }

        activeSlotId = oldActiveSlot;
    }

    private void OnUnEquipUpdateItemSets(int itemId)
    {
        if (!DataManager.CombosForEquipmentItem.TryGetValue(itemId, out var comboNameList))
            return;

        var oldActiveSlot = activeSlotId; //don't want to cause issues if we call OnUnEquipUpdateItemSets on cards

        foreach (var comboName in comboNameList)
        {
            if (!ActiveItemCombos.TryGetValue(comboName, out var comboSlot))
                continue;

            if (IsComboPrereqsMet(comboName))
                continue;

            activeSlotId = comboSlot;
            DataManager.EquipmentComboInteractions[comboName].OnUnequip(Player, Player.CombatEntity, this, default, EquipSlot.None);
            ActiveItemCombos.Remove(comboName);

            ReverseEquipEffectsForSlot(comboSlot);
        }

        activeSlotId = oldActiveSlot;
    }

    public void RunAllOnEquip()
    {
        if (Player.Inventory == null)
        {
#if DEBUG
            for (var i = 0; i < 10; i++)
                if (ItemSlots[i] > 0)
                    throw new Exception($"Player inventory is empty, but we still have items in our equip state!");
#endif
            return;
        }

        for (var i = 0; i < 10; i++)
            OnEquipEvent((EquipSlot)i);

        if (AmmoId > 0 && DataManager.ItemList.TryGetValue(AmmoId, out var equipInfo))
        {
            EquipAmmo(AmmoId, true, false, true);
            //equipInfo.Interaction?.OnEquip(Player, Player.CombatEntity, this, new UniqueItem(), EquipSlot.Ammunition);
        }
    }

    public int Refine
    {
        get
        {
            if (ItemIds[(int)activeSlotId] <= 0 || Player.Inventory == null)
                return 0;
            if (!Player.Inventory.UniqueItems.TryGetValue(ItemSlots[(int)activeSlotId], out var item))
                return 0;

            return (int)item.Refine;
        }
    }

    public bool IsInPosition(EquipPosition pos)
    {
        switch ((EquipSlot)activeSlotId)
        {
            case EquipSlot.HeadTop:
                return (pos & EquipPosition.HeadUpper) > 0;
            case EquipSlot.HeadMid:
                return (pos & EquipPosition.HeadMid) > 0;
            case EquipSlot.HeadBottom:
                return (pos & EquipPosition.HeadLower) > 0;
            case EquipSlot.Body:
                return (pos & EquipPosition.Body) > 0;
            case EquipSlot.Weapon:
                return (pos & EquipPosition.Weapon) > 0;
            case EquipSlot.Shield:
                return (pos & EquipPosition.Shield) > 0;
            case EquipSlot.Garment:
                return (pos & EquipPosition.Garment) > 0;
            case EquipSlot.Footgear:
                return (pos & EquipPosition.Footgear) > 0;
            case EquipSlot.Accessory1:
            case EquipSlot.Accessory2:
                return (pos & EquipPosition.Accessory) > 0;
        }

        return false;
    }

    public void AutoSpellOnAttack(CharacterSkill skill, int level, int chance, SkillPreferredTarget target = SkillPreferredTarget.Any)
    {
        var cast = new AutoSpellEffect()
        {
            Skill = skill,
            Level = level,
            Chance = chance,
            Target = target
        };

        var id = nextId++;
        AutoSpellSkillsOnAttack.Add(id, cast);

        var equipState = new EquipStatChange()
        {
            Slot = (int)activeSlotId,
            Stat = CharacterStat.AutoSpellOnAttacking,
            Value = (int)skill,
            Change = id,
        };

        equipmentEffects.Add(ref equipState);
    }

    public void AutoSpellWhenAttacked(CharacterSkill skill, int level, int chance, SkillPreferredTarget target = SkillPreferredTarget.Any)
    {
        var cast = new AutoSpellEffect()
        {
            Skill = skill,
            Level = level,
            Chance = chance,
            Target = target
        };

        var id = nextId++;
        AutoSpellSkillsWhenAttacked.Add(id, cast);

        var equipState = new EquipStatChange()
        {
            Slot = (int)activeSlotId,
            Stat = CharacterStat.AutoSpellWhenAttacked,
            Value = (int)skill,
            Change = id,
        };

        equipmentEffects.Add(ref equipState);
    }

    /// <summary>
    /// A chance to find an item when the wearer kills anything.
    ///
    /// Item codes are given as one comma separated string rather than as a parameter list,
    /// because that is a plain literal and needs nothing of the script language. When more
    /// than one is named the roll picks one of them, which is how the cards that offer a
    /// choice are written: "3% chance to find Apple Juice, Banana Juice, Carrot Juice" is
    /// one roll and one juice, not three rolls.
    /// </summary>
    public void AddBonusDropOnKill(int chance, string itemCodes) =>
        RegisterBonusDrop(chance, null, itemCodes);

    /// <summary>The same, but only when what died was of the named race.</summary>
    public void AddBonusDropOnKillRace(CharacterRace race, int chance, string itemCodes) =>
        RegisterBonusDrop(chance, race, itemCodes);

    private void RegisterBonusDrop(int chance, CharacterRace? race, string itemCodes)
    {
        if (chance <= 0 || string.IsNullOrWhiteSpace(itemCodes))
            return;

        var codes = itemCodes.Split(',');
        var ids = new List<int>(codes.Length);
        foreach (var code in codes)
        {
            var trimmed = code.Trim();
            if (trimmed.Length == 0)
                continue;

            //a card naming an item that is not in the tables is a mistake in the card, and
            //saying so once at equip time beats a bonus that silently never happens
            if (DataManager.ItemIdByName.TryGetValue(trimmed, out var id))
                ids.Add(id);
            else
                ServerLogger.LogWarning($"Bonus drop effect refers to unknown item '{trimmed}'.");
        }

        if (ids.Count == 0)
            return;

        var effect = new BonusDropEffect() { ItemIds = ids.ToArray(), Race = race, Chance = chance };

        var id2 = nextId++;
        BonusDropsOnKill.Add(id2, effect);

        equipmentEffects.Add(new EquipStatChange()
        {
            Slot = (int)activeSlotId,
            Stat = CharacterStat.BonusDropOnKill,
            Value = ids[0],
            Change = id2,
        });
    }

    /// <summary>
    /// A chance to find zeny on a kill. Modelled as a drop with no items so it travels the
    /// same path and is removed the same way; the amount is carried in the two ids.
    /// </summary>
    public void AddBonusZenyOnKill(int chance, int min, int max)
    {
        if (chance <= 0 || max < min)
            return;

        var effect = new BonusDropEffect() { ItemIds = new[] { min, max }, Race = null, Chance = chance };

        var id = nextId++;
        BonusZenyOnKill.Add(id, effect);

        equipmentEffects.Add(new EquipStatChange()
        {
            Slot = (int)activeSlotId,
            Stat = CharacterStat.BonusZenyOnKill,
            Value = max,
            Change = id,
        });
    }

    public void GrantSkill(CharacterSkill skill, int level)
    {
        var equipState = new EquipStatChange()
        {
            Slot = (int)activeSlotId,
            Stat = CharacterStat.SkillValue,
            Value = (int)skill,
            Change = level,
        };
        equipmentEffects.Add(ref equipState);
        Player.GrantSkillToCharacter(skill, level);
        CommandBuilder.RefreshGrantedSkills(Player);
    }

    public void AddDamageVsTag(string tag, int change)
    {
        if (!DataManager.TagToIdLookup.TryGetValue(tag, out var tagId))
        {
            ServerLogger.LogWarning($"Item attempted to add bonus damage vs tag {tag}, but no monsters with that tag exists.");
            return;
        }

        var equipState = new EquipStatChange()
        {
            Slot = (int)activeSlotId,
            Change = change,
            Value = tagId,
            Stat = CharacterStat.DamageVsTag
        };

        equipmentEffects.Add(ref equipState);

        if (Player.AttackVersusTag == null)
            Player.AttackVersusTag = new Dictionary<int, int>();

        if (Player.AttackVersusTag.TryGetValue(tagId, out var existing))
            Player.AttackVersusTag[tagId] = existing + change;
        else
            Player.AttackVersusTag.Add(tagId, change);
    }


    public void AddResistVsTag(string tag, int change)
    {
        if (!DataManager.TagToIdLookup.TryGetValue(tag, out var tagId))
        {
            ServerLogger.LogWarning($"Item attempted to add bonus damage vs tag {tag}, but no monsters with that tag exists.");
            return;
        }

        var equipState = new EquipStatChange()
        {
            Slot = (int)activeSlotId,
            Change = change,
            Value = tagId,
            Stat = CharacterStat.ResistVsTag
        };

        equipmentEffects.Add(ref equipState);

        if (Player.ResistVersusTag == null)
            Player.ResistVersusTag = new Dictionary<int, int>();

        if (Player.ResistVersusTag.TryGetValue(tagId, out var existing))
            Player.ResistVersusTag[tagId] = existing + change;
        else
            Player.ResistVersusTag.Add(tagId, change);
    }


    public bool HasLearnedSkill(CharacterSkill skill, int lvl = 1) => Player.MaxLearnedLevelOfSkill(skill) >= lvl;

    /// <summary>
    /// Gives the weapon in hand an element it did not have.
    ///
    /// Called two ways: by the stone socketed into a forged weapon as it is equipped, and
    /// by an endow - Elemental Converter, Aspersio - landing on whatever is already held.
    /// The equip path has an appearance update after it either way, but the endow path does
    /// not change any equipment id and would otherwise leave everyone looking at a sword
    /// that has quietly become a fire sword without saying so.
    ///
    /// Only sent when the element actually moves, since this runs on every stat pass.
    /// </summary>
    public void ChangeWeaponElement(AttackElement element)
    {
        var changed = !isOffHand
            ? MainHandWeapon.OverrideElement != element
            : OffHandWeapon.OverrideElement != element;

        if (!isOffHand)
            MainHandWeapon.OverrideElement = element;
        else
            OffHandWeapon.OverrideElement = element;

        //the off hand has no glow of its own to tint, so nothing needs telling about it
        if (changed && !isOffHand && Player.Character.Map != null)
            CommandBuilder.UpdatePlayerAppearanceAuto(Player);
    }

    public bool IsBaseJob(JobType type) => JobTypes.IsBaseJob(Player.JobId, type);

    public void AddStat(CharacterStat stat, int change)
    {
#if DEBUG
        if (stat >= CharacterStat.Str && stat <= CharacterStat.Luk)
            ServerLogger.LogWarning($"Warning! Adding directly to a base stat {stat} in equip handler for {Player.Inventory?.UniqueItems[(int)activeSlotId]}! You probably want AddStat.");
#endif
        var equipState = new EquipStatChange()
        {
            Slot = (int)activeSlotId,
            Change = change,
            Stat = stat
        };
        equipmentEffects.Add(ref equipState);
        Player.CombatEntity.AddStat(stat, change);

        if (stat == CharacterStat.DoubleAttackChance)
            DoubleAttackModifiers++;
    }

    public void SubStat(CharacterStat stat, int change) => AddStat(stat, -change); //lol

    /// <summary>
    /// Takes hp off the wearer, down to one and no further, and shows them the number.
    /// </summary>
    /// <remarks>
    /// For the cursed weapon that charges you to put it down. It goes through the same
    /// path a poison tick does so the hit is visible and the books balance, and it stops
    /// at one hp because a card that kills you for unequipping it is a support ticket.
    /// </remarks>
    public void LoseHp(int amount)
    {
        var ce = Player.CombatEntity;
        var remaining = ce.GetStat(CharacterStat.Hp);
        if (amount >= remaining)
            amount = remaining - 1;
        if (amount <= 0)
            return;

        var di = new DamageInfo()
        {
            Damage = amount,
            Result = AttackResult.NormalDamage,
            Source = Player.Entity,
            Target = Player.Entity,
            AttackSkill = CharacterSkill.NoCast,
            HitCount = 1,
            AttackPosition = Player.Character.Position,
            Flags = DamageApplicationFlags.NoHitLock | DamageApplicationFlags.SkipOnHitTriggers
        };

        ce.ExecuteCombatResult(di, false, false);

        Player.Character.Map?.AddVisiblePlayersAsPacketRecipients(Player.Character);
        CommandBuilder.AttackMulti(null, Player.Character, di, false);
        CommandBuilder.ClearRecipients();
    }

    public void AddStatusEffect(CharacterStatusEffect statusEffect, int duration, int val1 = 0, int val2 = 0)
    {
        var status = StatusEffectState.NewStatusEffect(statusEffect, duration / 1000f, val1, val2);
        Player.CombatEntity.AddStatusEffect(status);
    }

    public void RemoveStatusEffect(CharacterStatusEffect statusEffect)
    {
        Player.CombatEntity.RemoveStatusOfTypeIfExists(statusEffect);
    }

    public void SetPreserveStatusOnDeath(CharacterStatusEffect statusEffect, bool enabled)
    {
        if (enabled)
            Player.CombatEntity.StatusContainer?.SetStatusToKeepOnDeath(statusEffect);
        else
            Player.CombatEntity.StatusContainer?.RemoveStatusFromKeepOnDeath(statusEffect);
    }

    public void SetArmorElement(CharacterElement element)
    {
        if (activeSlotId != (int)EquipSlot.Body)
            ServerLogger.LogWarning(
                $"Warning! Attempting to call SetArmorElement on a card or property in the {activeSlotId} slot. CallStack:\n" +
                Environment.StackTrace);
        else
            ArmorElement = element;
    }

    public int GetExpectedSerializedSize()
    {
        return ItemSlots.Length * 17 + 4; //guids for each inventory slot + 4 for equipped ammo type
    }

    public void Serialize(IBinaryMessageWriter bw)
    {
        if (Player.Inventory == null)
            return;

        foreach (var itemId in ItemSlots)
        {
            bw.Write(itemId > 0);
            if (itemId > 0)
                bw.Write(Player.Inventory.GetGuidByUniqueItemId(itemId).ToByteArray()); //we have a bag id, we want to store the guid
        }

        bw.Write(AmmoId);
    }

    public void DeSerialize(IBinaryMessageReader br, CharacterBag bag)
    {
        for (var i = 0; i < 10; i++)
        {
            if (br.ReadBoolean())
            {
                var guid = new Guid(br.ReadBytes(16)); //we have a guid, we want to store a bag id
                var bagId = bag.GetUniqueItemByGuid(guid, out var item);

                if (bagId > 0)
                {
                    ItemSlots[i] = bagId;
                    ItemIds[i] = item.Id;
                }

                if (i < 3)
                {
                    var equipInfo = DataManager.ArmorInfo[item.Id];
                    headgearMultiSlotInfo[i] = equipInfo.HeadPosition;
                }

                if (i == (int)EquipSlot.Weapon)
                {
                    var weaponInfo = DataManager.WeaponInfo[item.Id];
                    if (weaponInfo.IsTwoHanded)
                        isTwoHandedWeapon = true;
                }
            }
        }

        EquipAmmo(br.ReadInt32(), false);
    }
}