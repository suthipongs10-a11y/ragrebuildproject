using System.Collections.Concurrent;
using RoRebuildServer.Data;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Custom.Moderation;

/// <summary>
/// The limits a connection is held to on its way in: how many may be online, how many
/// accounts may exist, how many one address may make, and how many wrong passwords one
/// address may try.
/// </summary>
/// <remarks>
/// Written for the first closed test - about twenty people on a small machine - where the
/// two things that go wrong are a friend of a friend of a friend turning up until the
/// server crawls, and a bot finding the address and making accounts until the database is
/// nothing but bots. Neither is a ban: a ban is for somebody who did something, and these
/// are for nobody in particular.
///
/// Everything here is in memory and per process. The tallies reset when the server
/// restarts, which is fine - they are there to slow a flood down, not to keep books - and
/// the account count is read from the database once at startup and kept in step by the
/// code that makes accounts.
///
/// Every one of the limits is a setting, and zero switches it off, so a private server
/// behind a router can run with none of this in the way.
/// </remarks>
public static class ConnectionGate
{
    private const double FailureWindowSeconds = 600;
    private const double RegistrationWindowSeconds = 86400;

    private sealed class Tally
    {
        public int Count;
        public DateTime WindowStart;
    }

    private static readonly ConcurrentDictionary<string, Tally> failedLogins = new();
    private static readonly ConcurrentDictionary<string, Tally> registrations = new();

    /// <summary>How many accounts exist. Read from the database at startup, and bumped by every account made since.</summary>
    public static int AccountCount;

    private static int CountInWindow(ConcurrentDictionary<string, Tally> table, string address, double windowSeconds)
    {
        if (!table.TryGetValue(address, out var tally))
            return 0;

        lock (tally)
        {
            if ((DateTime.UtcNow - tally.WindowStart).TotalSeconds > windowSeconds)
            {
                tally.Count = 0;
                tally.WindowStart = DateTime.UtcNow;
            }

            return tally.Count;
        }
    }

    private static void Bump(ConcurrentDictionary<string, Tally> table, string address, double windowSeconds)
    {
        var tally = table.GetOrAdd(address, _ => new Tally { WindowStart = DateTime.UtcNow });

        lock (tally)
        {
            if ((DateTime.UtcNow - tally.WindowStart).TotalSeconds > windowSeconds)
            {
                tally.Count = 0;
                tally.WindowStart = DateTime.UtcNow;
            }

            tally.Count++;
        }
    }

    /// <summary>Whether this address has guessed at passwords too often lately to be given another go.</summary>
    public static bool IsLockedOut(string address, out string reason)
    {
        reason = "";

        var limit = ServerConfig.OperationConfig.MaxFailedLoginsPerAddress;
        if (limit <= 0 || string.IsNullOrEmpty(address))
            return false;

        if (CountInWindow(failedLogins, address, FailureWindowSeconds) < limit)
            return false;

        reason = "ใส่รหัสผ่านผิดหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่";
        return true;
    }

    public static void RecordFailedLogin(string address)
    {
        if (ServerConfig.OperationConfig.MaxFailedLoginsPerAddress <= 0 || string.IsNullOrEmpty(address))
            return;

        Bump(failedLogins, address, FailureWindowSeconds);
    }

    /// <summary>Whether a new account may be made right now, from this address.</summary>
    public static bool CanRegister(string address, out string reason)
    {
        reason = "";
        var config = ServerConfig.OperationConfig;

        if (!config.AllowRegistration)
        {
            reason = "เซิร์ฟเวอร์ปิดรับสมัครบัญชีใหม่อยู่ในตอนนี้";
            return false;
        }

        if (config.MaxAccounts > 0 && AccountCount >= config.MaxAccounts)
        {
            reason = $"บัญชีสำหรับรอบทดสอบเต็มแล้ว ({config.MaxAccounts} บัญชี) ขอบคุณที่สนใจ รอบหน้าจะเปิดเพิ่ม";
            return false;
        }

        if (config.MaxNewAccountsPerAddressPerDay > 0 && !string.IsNullOrEmpty(address)
            && CountInWindow(registrations, address, RegistrationWindowSeconds) >= config.MaxNewAccountsPerAddressPerDay)
        {
            reason = $"สร้างบัญชีจากที่อยู่นี้ครบ {config.MaxNewAccountsPerAddressPerDay} บัญชีต่อวันแล้ว";
            return false;
        }

        return true;
    }

    /// <summary>Called once an account has actually been made, so the per-address tally is of accounts and not of attempts.</summary>
    public static void RecordRegistration(string address)
    {
        if (!string.IsNullOrEmpty(address))
            Bump(registrations, address, RegistrationWindowSeconds);
    }

    /// <summary>Whether there is a seat for this account. A named GM always has one.</summary>
    public static bool HasRoom(string accountName, out string reason)
    {
        reason = "";

        var limit = ServerConfig.OperationConfig.MaxOnlinePlayers;
        if (limit <= 0)
            return true;

        if (ServerLockdown.IsAdminAccount(accountName))
            return true;

        if (NetworkManager.PlayerCount < limit)
            return true;

        reason = $"เซิร์ฟเวอร์เต็มแล้ว ({limit} คน) กรุณารอสักครู่แล้วลองใหม่";
        return false;
    }

    /// <summary>Says what the limits are, once, on the way up - beside the lockdown report they belong with.</summary>
    public static void Report()
    {
        var config = ServerConfig.OperationConfig;
        var online = config.MaxOnlinePlayers > 0 ? config.MaxOnlinePlayers.ToString() : "no limit";
        var accounts = config.MaxAccounts > 0 ? config.MaxAccounts.ToString() : "no limit";
        var registration = config.AllowRegistration ? "open" : "closed";

        ServerLogger.Log($"[Gate] Online players: {online}. Accounts: {AccountCount} of {accounts}, registration {registration}, "
                         + $"{config.MaxNewAccountsPerAddressPerDay} new per address a day, {config.MaxFailedLoginsPerAddress} wrong passwords per address.");
    }
}
