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
    public int OfflineVendingHours { get; set; } = 48;
    public float EtcItemValueMultiplier { get; set; }
    /// <summary>
    /// Whether this is a server the public can reach.
    /// </summary>
    /// <remarks>
    /// One switch instead of seven. Every cheat door in the settings has to be shut before a
    /// server opens, they live in two different sections of two different files, and the file
    /// that is loaded by a plain dotnet run is not the one anybody remembers to check. Left
    /// as seven things to remember, the question is not whether one gets forgotten.
    ///
    /// Set this and the server shuts them itself at startup, whatever the rest of the file
    /// says - see Custom.Moderation.ServerLockdown. It never opens one, so a live server
    /// cannot be talked back into debug mode by a stale settings file.
    /// </remarks>
    public bool LiveServer { get; set; }

    /// <summary>
    /// The accounts that are GMs, by the name they log in under.
    /// </summary>
    /// <remarks>
    /// The only way to have a GM once LiveServer is on, and deliberately so: adminify hands
    /// out admin to whoever knows a passcode, and a passcode is a thing that gets said in
    /// chat once and then belongs to everybody.
    /// </remarks>
    public List<string> AdminAccounts { get; set; } = new();

    public List<string> ActiveEvents { get; set; } = new();
    public List<string> FeatureFlags { get; set; } = new();
}