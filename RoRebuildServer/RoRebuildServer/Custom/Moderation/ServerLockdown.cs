using RoRebuildServer.Data;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom.Moderation;

/// <summary>
/// Shuts the cheat doors on a live server, and says out loud which ones are open on any
/// other one.
/// </summary>
/// <remarks>
/// The settings that let a player cheat are spread across two sections of a file, and there
/// are three files: the base one, a Development one that a plain dotnet run loads, and a
/// Production one that only loads when an environment variable says so. The Development one
/// turns on debug mode, which makes every player who logs in an admin. Nothing anywhere said
/// so, and the run command written down for this project is the one that loads it.
///
/// So this does two things and neither of them is a suggestion. On a live server it forces
/// every one of those settings off in code, after the files have been read, so a file nobody
/// remembered to check cannot open a door. On every server it prints what is open, on the way
/// up, in the log everybody watches while waiting for "Server started" - because the failure
/// this is here to prevent is silent, and the fix for a silent failure is noise.
///
/// It only ever shuts doors. There is no setting here that turns a protection off.
/// </remarks>
public static class ServerLockdown
{
    private static HashSet<string> adminAccounts = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Whether this server has been told it is open to the public.</summary>
    public static bool IsLive { get; private set; }

    /// <summary>
    /// Called once, before anything is listening. Reads the config, overrules it where it
    /// has to, and reports.
    /// </summary>
    public static void Apply()
    {
        var operation = ServerConfig.OperationConfig;
        var debug = ServerConfig.DebugConfig;

        IsLive = operation.LiveServer;

        adminAccounts = new HashSet<string>(
            operation.AdminAccounts.Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim()),
            StringComparer.OrdinalIgnoreCase);

        //The seeded GM counts as named even when the settings file forgot it: the file it
        //comes from is only ever on the machine of whoever set the server up.
        if (GmAccountSeed.TryRead(out var seededName, out _))
            adminAccounts.Add(seededName);

        if (!IsLive)
        {
            ReportOpenDoors(operation, debug);
            return;
        }

        var shut = new List<string>();

        //Debug mode is the one that matters most and reads the most harmlessly. It makes
        //every player an admin as they load, so with it on there is no such thing as a
        //command a player cannot use.
        if (debug.UseDebugMode) { debug.UseDebugMode = false; shut.Add("UseDebugMode"); }

        //Adminify hands admin to anybody with the passcode. On a live server the passcode is
        //a secret exactly until the first time somebody says it out loud.
        if (operation.AllowAdminifyCommand) { operation.AllowAdminifyCommand = false; shut.Add("AllowAdminifyCommand"); }
        operation.AdminifyPasscode = "";

        //Warping anywhere for free is the whole game skipped, and this one was left on in
        //the production settings as well as the others.
        if (debug.EnableWarpCommandForEveryone) { debug.EnableWarpCommandForEveryone = false; shut.Add("EnableWarpCommandForEveryone"); }
        if (debug.EnableRandomMoveForEveryone) { debug.EnableRandomMoveForEveryone = false; shut.Add("EnableRandomMoveForEveryone"); }
        if (debug.EnableEnterSpecificMap) { debug.EnableEnterSpecificMap = false; shut.Add("EnableEnterSpecificMap"); }

        if (debug.UnlimitedSkillPoints) { debug.UnlimitedSkillPoints = false; shut.Add("UnlimitedSkillPoints"); }
        if (debug.DebugMapOnly) { debug.DebugMapOnly = false; shut.Add("DebugMapOnly"); }

        ServerLogger.Log("[Lockdown] LiveServer is on: this server is treated as open to the public.");

        if (shut.Count > 0)
            ServerLogger.LogWarning($"[Lockdown] Overruled the settings file and switched off: {string.Join(", ", shut)}");

        if (adminAccounts.Count == 0)
            ServerLogger.LogWarning("[Lockdown] No AdminAccounts are named, so nobody can use the GM commands. " +
                                    "Put your own account name in ServerOperationConfig.AdminAccounts.");
        else
            ServerLogger.Log($"[Lockdown] GM account(s): {string.Join(", ", adminAccounts)}");
    }

    /// <summary>
    /// The same list, said out loud, when the server has not been told it is live.
    /// </summary>
    private static void ReportOpenDoors(Data.Config.ServerOperationConfig operation, Data.Config.ServerDebugConfig debug)
    {
        var open = new List<string>();

        if (debug.UseDebugMode) open.Add("UseDebugMode (every player who logs in is an admin)");
        if (operation.AllowAdminifyCommand) open.Add($"AllowAdminifyCommand (passcode '{operation.AdminifyPasscode}')");
        if (debug.EnableWarpCommandForEveryone) open.Add("EnableWarpCommandForEveryone (/warp for anyone)");
        if (debug.EnableRandomMoveForEveryone) open.Add("EnableRandomMoveForEveryone");
        if (debug.EnableEnterSpecificMap) open.Add("EnableEnterSpecificMap");
        if (debug.UnlimitedSkillPoints) open.Add("UnlimitedSkillPoints");

        if (open.Count == 0)
            return;

        ServerLogger.LogWarning("[Lockdown] ============================================================");
        ServerLogger.LogWarning("[Lockdown] This server is NOT marked live, and these are open to every player:");
        foreach (var entry in open)
            ServerLogger.LogWarning($"[Lockdown]   - {entry}");
        ServerLogger.LogWarning("[Lockdown] Set ServerOperationConfig.LiveServer to true before letting anybody in.");
        ServerLogger.LogWarning("[Lockdown] ============================================================");
    }

    /// <summary>Whether this account is one of the named GMs.</summary>
    public static bool IsAdminAccount(string? accountName) =>
        !string.IsNullOrWhiteSpace(accountName) && adminAccounts.Contains(accountName);
}
