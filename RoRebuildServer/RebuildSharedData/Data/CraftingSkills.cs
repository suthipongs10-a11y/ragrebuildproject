using RebuildSharedData.Enum;

namespace RebuildSharedData.Data;

/// <summary>
/// The skills that open the forge instead of casting.
///
/// Both sides need the same list. The client asks it whether a pressed skill should open
/// a window rather than go on the cursor, and the server asks it before answering a craft
/// request, so a skill that is not on this list can never be used to make anything even
/// if a recipe names it.
///
/// The recipes themselves live in Db/ProduceRecipes.csv - this is only which skills are
/// allowed to have any.
///
/// Oridecon Research is deliberately not here. It sounds like an ore skill and is not one:
/// it raises the success rate of forging level 3 weapons, and the ore it is named after is
/// combined by the smelting npcs in Prontera, Payon, Morroc and Alberta, free and without
/// a roll. Putting it here would have offered a worse version of something already free.
/// </summary>
public static class CraftingSkills
{
    public static bool IsCraftingSkill(CharacterSkill skill) => skill switch
    {
        CharacterSkill.IronTempering => true,
        CharacterSkill.SteelTempering => true,
        CharacterSkill.EnchantedStoneCraft => true,
        CharacterSkill.SmithBladeWeapon => true,
        CharacterSkill.SmithBluntWeapon => true,
        CharacterSkill.SmithPiercingWeapon => true,
        _ => false
    };

    /// <summary>
    /// Whether a stone or a star crumb may be bound into what this skill makes.
    ///
    /// Only the three weapon skills. An ore skill's window has no sockets, and asking the
    /// client to work that out from whether the result happens to be a weapon would put
    /// the rule in two places.
    /// </summary>
    public static bool IsWeaponSmithingSkill(CharacterSkill skill) => skill switch
    {
        CharacterSkill.SmithBladeWeapon => true,
        CharacterSkill.SmithBluntWeapon => true,
        CharacterSkill.SmithPiercingWeapon => true,
        _ => false
    };
}
