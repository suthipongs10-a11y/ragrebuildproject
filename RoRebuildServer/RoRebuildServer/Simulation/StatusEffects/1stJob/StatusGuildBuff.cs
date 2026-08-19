using RebuildSharedData.Enum;
using RoRebuildServer.Simulation.StatusEffects.Setup;

namespace RoRebuildServer.Simulation.StatusEffects._1stJob;

/// <summary>
/// The mark that a guild's skills are working on this character.
///
/// It does nothing by itself - the bonuses are applied during the player's stat
/// recalculation, where they cannot be left behind - so this exists only to put something
/// on the buff bar. A permanent effect that changed stats here as well would be the same
/// add-and-remove pairing that recalculation was chosen to avoid, in a second place.
///
/// StayOnClear so dying does not take it off: it is not a buff anybody cast.
/// </summary>
[StatusEffectHandler(CharacterStatusEffect.GuildBuff, StatusClientVisibility.Everyone,
    StatusEffectFlags.StayOnClear)]
public class StatusGuildBuff : StatusEffectBase
{
}
