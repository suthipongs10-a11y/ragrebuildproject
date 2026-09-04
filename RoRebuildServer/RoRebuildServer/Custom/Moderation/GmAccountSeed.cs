using System.Text.Json;
using RoRebuildServer.Data;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom.Moderation;

/// <summary>
/// The GM account the server makes for itself on first boot, read from a small json file
/// that is kept out of git.
/// </summary>
/// <remarks>
/// On a server anybody can reach, the GM account has to exist before the first stranger
/// does - otherwise the name in AdminAccounts belongs to whoever registers it first, and
/// that person is a GM. Making it by hand means somebody remembering to, in the minute
/// between starting the server and telling people about it. So the server does it.
///
/// The file holds a password, which is why it is a file of its own rather than a line in
/// appsettings: the settings are committed and the password must not be. It is read twice
/// on the way up - by the lockdown, for the name, so the account counts as a GM even if
/// AdminAccounts forgot it; and by the database, to create it if nobody has it yet. A file
/// that is missing means nothing is seeded, which is the right thing for a developer's own
/// machine.
///
/// Format:
///   { "AccountName": "gmrebuild", "Password": "..." }
/// </remarks>
public static class GmAccountSeed
{
    private sealed class SeedFile
    {
        public string? AccountName { get; set; }
        public string? Password { get; set; }
    }

    private static readonly JsonSerializerOptions options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    /// <summary>Where the file is looked for: the setting, relative to the server folder.</summary>
    public static string FilePath =>
        System.IO.Path.GetFullPath(ServerConfig.OperationConfig.GmSeedFile ?? "GmAccount.local.json", AppContext.BaseDirectory);

    public static bool TryRead(out string accountName, out string password)
    {
        accountName = "";
        password = "";

        var path = FilePath;
        if (!File.Exists(path))
            return false;

        try
        {
            var seed = JsonSerializer.Deserialize<SeedFile>(File.ReadAllText(path), options);
            if (seed == null || string.IsNullOrWhiteSpace(seed.AccountName) || string.IsNullOrWhiteSpace(seed.Password))
            {
                ServerLogger.LogWarning($"[Lockdown] The GM seed file at {path} needs both AccountName and Password, so no GM account was seeded.");
                return false;
            }

            accountName = seed.AccountName.Trim();
            password = seed.Password;
            return true;
        }
        catch (Exception e)
        {
            ServerLogger.LogWarning($"[Lockdown] Could not read the GM seed file at {path}: {e.Message}");
            return false;
        }
    }
}
