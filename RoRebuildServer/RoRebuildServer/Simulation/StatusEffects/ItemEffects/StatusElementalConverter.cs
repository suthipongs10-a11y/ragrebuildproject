using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.StatusEffects.Setup;

namespace RoRebuildServer.Simulation.StatusEffects.ItemEffects;

[StatusEffectHandler(CharacterStatusEffect.ElementalConverterFire, StatusClientVisibility.Owner, shareGroup: "ElementalEndow")]
[StatusEffectHandler(CharacterStatusEffect.ElementalConverterWater, StatusClientVisibility.Owner, shareGroup: "ElementalEndow")]
[StatusEffectHandler(CharacterStatusEffect.ElementalConverterWind, StatusClientVisibility.Owner, shareGroup: "ElementalEndow")]
[StatusEffectHandler(CharacterStatusEffect.ElementalConverterEarth, StatusClientVisibility.Owner, shareGroup: "ElementalEndow")]
[StatusEffectHandler(CharacterStatusEffect.CursedWater, StatusClientVisibility.Owner, shareGroup: "ElementalEndow")]
[StatusEffectHandler(CharacterStatusEffect.EnchantPoison, StatusClientVisibility.Owner, shareGroup: "ElementalEndow")]
[StatusEffectHandler(CharacterStatusEffect.Aspersio, StatusClientVisibility.Ally, shareGroup: "ElementalEndow")]
public class StatusElementalConverter : StatusEffectBase
{
    public override StatusUpdateMode UpdateMode => StatusUpdateMode.OnChangeEquipment;

    public override StatusUpdateResult OnChangeEquipment(CombatEntity ch, ref StatusEffectState state)
    {
        if (ch.Character.Type != CharacterType.Player)
            return StatusUpdateResult.Continue;

        if (ch.Player.GetItemIdForEquipSlot(EquipSlot.Weapon) != state.Value2)
            return StatusUpdateResult.EndStatus;

        return StatusUpdateResult.Continue;
    }

    public override void OnApply(CombatEntity ch, ref StatusEffectState state)
    {
        state.Value1 = state.Type switch
        {
            CharacterStatusEffect.ElementalConverterFire => 3,
            CharacterStatusEffect.ElementalConverterWater => 2,
            CharacterStatusEffect.ElementalConverterWind => 4,
            CharacterStatusEffect.ElementalConverterEarth => 1,
            CharacterStatusEffect.CursedWater => 7,
            CharacterStatusEffect.EnchantPoison => 5,
            CharacterStatusEffect.Aspersio => 8,
            _ => state.Value1
        };

        if (state.Type == CharacterStatusEffect.EnchantPoison)
            ch.AddStat(CharacterStat.OnMeleeAttackPoison, state.Value3);

        ch.SetStat(CharacterStat.EndowAttackElement, state.Value1);
        if (ch.Character.Type == CharacterType.Player)
        {
            state.Value2 = ch.Player.GetItemIdForEquipSlot(EquipSlot.Weapon);

            //The weapon has just changed element without changing at all, so everyone
            //looking at it has to be told - this is the difference between a blade that
            //lights up when the converter lands and one that never does.
            if (ch.Player.Character.Map != null)
                CommandBuilder.UpdatePlayerAppearanceAuto(ch.Player);
        }
    }

    public override void OnExpiration(CombatEntity ch, ref StatusEffectState state)
    {
        if (ch.GetStat(CharacterStat.EndowAttackElement) == state.Value1)
            ch.SetStat(CharacterStat.EndowAttackElement, 0);
        if (state.Type == CharacterStatusEffect.EnchantPoison)
            ch.SubStat(CharacterStat.OnMeleeAttackPoison, state.Value3);

        //and the light goes out again when it wears off
        if (ch.Character.Type == CharacterType.Player && ch.Player.Character.Map != null)
            CommandBuilder.UpdatePlayerAppearanceAuto(ch.Player);
    }
}