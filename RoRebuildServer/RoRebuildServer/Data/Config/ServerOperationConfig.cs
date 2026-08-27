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
    //one harmless gift monster per map that has monsters. See GiftMonsterSpawner.
    public bool SpawnGiftMonsters { get; set; } = true;
    public bool FliersIgnoreTraps { get; set; } = true;
    public bool SleepMonsterOnEmptyMap { get; set; } = true;
    public int MapMonsterSleepTimer { get; set; } = 600;
    public CastInterruptionMode DefaultCastInterruptMode { get; set; } = CastInterruptionMode.InterruptOnSkill;
    //How long a vending shop is allowed to stand after its owner has logged out, in
    //hours. Zero switches offline shops off entirely and the button that opens one stops
    //being offered. See Simulation.OfflineVending for what the number actually buys: the
    //seller's character stays in the world for that long, which keeps the map it is on
    //awake, so this is a number to keep modest rather than a number to maximise.
    public int OfflineVendingHours { get; set; } = 12;
    public float EtcItemValueMultiplier { get; set; }
    public List<string> ActiveEvents { get; set; } = new();
    public List<string> FeatureFlags { get; set; } = new();
}