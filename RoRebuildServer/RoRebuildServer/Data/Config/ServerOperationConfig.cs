using RebuildSharedData.ClientTypes;

namespace RoRebuildServer.Data.Config;

public class ServerOperationConfig
{
    public string? KeyPersistencePath { get; set; }
    public bool UseMultipleThreads { get; set; }
    public int MapChunkSize { get; set; }
    public int ClientTimeoutSeconds { get; set; }
    public bool UseAccurateSpawnZoneFormula { get; set; }
    public bool AllowAdminifyCommand { get; set; }
    public string? AdminifyPasscode { get; set; }
    public bool RemapDropRates { get; set; }
    public bool GuaranteeMvpDrops { get; set; } = true;
    //ordinary monsters swing, they do not cast. See MonsterSkillAiState for what this
    //counts as a boss and why the two are tied to the same flag.
    public bool RestrictMonsterSkillsToBosses { get; set; } = true;
    public bool FliersIgnoreTraps { get; set; } = true;
    public bool SleepMonsterOnEmptyMap { get; set; } = true;
    public int MapMonsterSleepTimer { get; set; } = 600;
    public CastInterruptionMode DefaultCastInterruptMode { get; set; } = CastInterruptionMode.InterruptOnSkill;
    public float EtcItemValueMultiplier { get; set; }
    public List<string> ActiveEvents { get; set; } = new();
    public List<string> FeatureFlags { get; set; } = new();
}