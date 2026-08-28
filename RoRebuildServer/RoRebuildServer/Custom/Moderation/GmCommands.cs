using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation;

namespace RoRebuildServer.Custom.Moderation;

/// <summary>
/// The commands a GM types to see who is on and to throw somebody off.
/// </summary>
/// <remarks>
/// Hung off ordinary chat, the same trick AdminTestChat uses and for the same reason: a
/// packet of its own lives in RebuildSharedData, which reaches the client only after
/// updateclient.bat has copied the dll across. These have to work against whatever client a
/// GM happens to have open, including one built last week, and they have to be addable one
/// at a time without a client build each.
///
/// Every one of them is refused to anybody who is not an admin, and refused with an answer
/// rather than silence - a command that vanishes gets typed again, and the second attempt
/// goes out as public chat.
///
/// What is deliberately not here: anything that bans on its own judgement. Every command
/// below either shows a GM something or does exactly what they typed. The nearest thing to
/// automation is !alt, which prints a list of accounts sharing an address and leaves the
/// decision where it belongs.
/// </remarks>
public static class GmCommands
{
    private const string Prefix = "!";

    /// <summary>How many lines one listing command is allowed to send.</summary>
    private const int MaxLines = 40;

    private static readonly DateTime Forever = BanList.Forever;

    /// <summary>Answers the message if it was for us, and says whether it was.</summary>
    public static bool TryHandle(Player player, string text)
    {
        if (string.IsNullOrWhiteSpace(text) || !text.StartsWith(Prefix, StringComparison.Ordinal))
            return false;

        var parts = text.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var command = parts[0].ToLowerInvariant();

        switch (command)
        {
            case "!who":
            case "!kick":
            case "!ban":
            case "!banacct":
            case "!banip":
            case "!unban":
            case "!unbanip":
            case "!bans":
            case "!alt":
            case "!gm":
                break;
            default:
                return false; //not ours - let the chat handler carry on with it
        }

        if (!player.IsAdmin)
        {
            Tell(player, "<color=#FF5555>คำสั่งนี้ใช้ได้เฉพาะ GM</color>");
            return true;
        }

        switch (command)
        {
            case "!gm": ShowHelp(player); break;
            case "!who": Who(player); break;
            case "!kick": Kick(player, parts); break;
            case "!ban": Ban(player, parts, byAccountName: false); break;
            case "!banacct": Ban(player, parts, byAccountName: true); break;
            case "!banip": BanIp(player, parts); break;
            case "!unban": Unban(player, parts); break;
            case "!unbanip": UnbanIp(player, parts); break;
            case "!bans": Bans(player); break;
            case "!alt": Alt(player, parts); break;
        }

        return true;
    }

    private static void ShowHelp(Player player)
    {
        Tell(player, "<color=#FFCC55>คำสั่ง GM</color>");
        Tell(player, "!who — ใครออนไลน์อยู่บ้าง อยู่แมพไหน ไอพีอะไร");
        Tell(player, "!alt <ชื่อตัวละคร> — บัญชีอื่นที่เคยใช้ไอพีเดียวกัน");
        Tell(player, "!kick <ชื่อตัวละคร> — เตะออก ไม่ได้แบน");
        Tell(player, "!ban <ชื่อตัวละคร> <เวลา> [เหตุผล] — แบนบัญชีที่ตัวละครนั้นอยู่ แล้วเตะออก");
        Tell(player, "!banacct <ชื่อบัญชี> <เวลา> [เหตุผล] — แบนบัญชีที่ไม่ได้ออนไลน์");
        Tell(player, "!banip <ชื่อตัวละคร|ไอพี> <เวลา> [เหตุผล] — แบนไอพี แล้วเตะทุกคนที่ใช้ไอพีนั้น");
        Tell(player, "!unban <ชื่อบัญชี> · !unbanip <ไอพี> · !bans — ดูรายการที่แบนอยู่");
        Tell(player, "<color=#AACCFF>เวลา: 30m 2h 7d หรือ perm (ถาวร)</color>");
    }

    // ---------------------------------------------------------------- who is on

    private static void Who(Player player)
    {
        var connections = NetworkManager.SnapshotConnections();
        var shown = 0;

        Tell(player, $"<color=#FFCC55>ออนไลน์ {connections.Count} คน</color>");

        foreach (var connection in connections)
        {
            if (shown >= MaxLines)
            {
                Tell(player, $"...และอีก {connections.Count - shown} คน");
                break;
            }

            var character = connection.Character;
            if (character == null)
            {
                Tell(player, $"[{connection.AccountName}] ยังอยู่หน้าเลือกตัวละคร  ·  {Address(connection)}");
                shown++;
                continue;
            }

            var map = character.Map?.Name ?? "-";
            var level = connection.Player?.GetData(PlayerStat.Level) ?? 0;
            var offline = connection.IsOfflineVending ? "  <color=#AACCFF>[ร้าน offline]</color>" : "";

            Tell(player, $"{character.Name}  Lv.{level}  {map}  ·  บัญชี {connection.AccountName}  ·  {Address(connection)}{offline}");
            shown++;
        }
    }

    private static string Address(NetworkConnection connection) =>
        string.IsNullOrEmpty(connection.RemoteAddress) ? "ไม่ทราบไอพี" : connection.RemoteAddress;

    // ---------------------------------------------------------------- shared addresses

    private static void Alt(Player player, string[] parts)
    {
        if (parts.Length < 2)
        {
            Tell(player, "ใช้: !alt <ชื่อตัวละคร>");
            return;
        }

        var name = string.Join(" ", parts.Skip(1));
        if (!TryFindOnline(name, out var target))
        {
            Tell(player, $"ไม่พบ {name} ออนไลน์อยู่ — !alt ดูได้เฉพาะคนที่กำลังเล่น");
            return;
        }

        var related = AddressLog.RelatedTo(target.AccountId);
        if (related.Count <= 1)
        {
            Tell(player, $"{name} (บัญชี {target.AccountName}) ไม่มีบัญชีอื่นใช้ไอพีร่วมกัน");
            return;
        }

        Tell(player, $"<color=#FFCC55>บัญชีที่ใช้ไอพีร่วมกับ {target.AccountName} — {related.Count} บัญชี</color>");
        Tell(player, "<color=#AACCFF>ไอพีเดียวกันไม่ได้แปลว่าบอท คนบ้านเดียวกันหรือใช้เน็ตมือถือก็ตรงกันได้</color>");

        var shown = 0;
        foreach (var (id, accountName, address) in related)
        {
            if (shown >= MaxLines)
            {
                Tell(player, $"...และอีก {related.Count - shown} บัญชี");
                break;
            }

            var self = id == target.AccountId ? "  <- คนนี้" : "";
            Tell(player, $"  {accountName}  ·  {address}{self}");
            shown++;
        }
    }

    // ---------------------------------------------------------------- throwing people off

    private static void Kick(Player player, string[] parts)
    {
        if (parts.Length < 2)
        {
            Tell(player, "ใช้: !kick <ชื่อตัวละคร>");
            return;
        }

        var name = string.Join(" ", parts.Skip(1));
        if (!TryFindOnline(name, out var target))
        {
            Tell(player, $"ไม่พบ {name} ออนไลน์อยู่");
            return;
        }

        NetworkManager.QueueDisconnect(target);
        Tell(player, $"เตะ {name} (บัญชี {target.AccountName}) ออกแล้ว");
        ServerLogger.Log($"[Ban] {player.Name} kicked {name} ({target.AccountName}).");
    }

    private static void Ban(Player player, string[] parts, bool byAccountName)
    {
        var what = byAccountName ? "ชื่อบัญชี" : "ชื่อตัวละคร";
        if (parts.Length < 3)
        {
            Tell(player, $"ใช้: {parts[0]} <{what}> <เวลา> [เหตุผล]   เช่น {parts[0]} SomeName 7d ใช้บอท");
            return;
        }

        if (!TryParseDuration(parts[2], out var expires))
        {
            Tell(player, "เวลาไม่ถูกต้อง ใช้ 30m 2h 7d หรือ perm");
            return;
        }

        var reason = parts.Length > 3 ? string.Join(" ", parts.Skip(3)) : "ไม่ได้ระบุเหตุผล";
        var name = parts[1];

        int accountId;
        string accountName;
        NetworkConnection? online = null;

        if (byAccountName)
        {
            if (!TryFindAccountByName(name, out accountId, out accountName))
            {
                Tell(player, $"ไม่รู้จักบัญชีชื่อ {name} — ชื่อบัญชีจะรู้จักก็ต่อเมื่อเคยล็อกอินเข้ามาแล้ว");
                return;
            }

            TryFindConnectionForAccount(accountId, out online);
        }
        else
        {
            if (!TryFindOnline(name, out var target))
            {
                Tell(player, $"ไม่พบ {name} ออนไลน์อยู่ — ถ้าออฟไลน์ไปแล้วใช้ !banacct <ชื่อบัญชี> แทน");
                return;
            }

            online = target;
            accountId = target.AccountId;
            accountName = target.AccountName;
        }

        //Guarded rather than trusted to good sense. Banning yourself locks the one account
        //that can lift bans out of the server, and it is exactly the sort of thing that gets
        //typed at two in the morning.
        if (accountId == player.Connection?.AccountId)
        {
            Tell(player, "แบนตัวเองไม่ได้");
            return;
        }

        var ban = BanList.BanAccount(accountId, accountName, expires, reason, player.Name);

        if (online != null)
            NetworkManager.QueueDisconnect(online);

        Tell(player, $"<color=#FF9955>แบนบัญชี {accountName} แล้ว ({BanList.Remaining(ban)}) — {reason}</color>");

        var address = AddressLog.LastAddressOf(accountId);
        if (!string.IsNullOrEmpty(address))
            Tell(player, $"<color=#AACCFF>ไอพีล่าสุดของบัญชีนี้คือ {address} — ถ้าจะแบนไอพีด้วยใช้ !banip {address} {parts[2]}</color>");
    }

    private static void BanIp(Player player, string[] parts)
    {
        if (parts.Length < 3)
        {
            Tell(player, "ใช้: !banip <ชื่อตัวละคร|ไอพี> <เวลา> [เหตุผล]");
            return;
        }

        if (!TryParseDuration(parts[2], out var expires))
        {
            Tell(player, "เวลาไม่ถูกต้อง ใช้ 30m 2h 7d หรือ perm");
            return;
        }

        var reason = parts.Length > 3 ? string.Join(" ", parts.Skip(3)) : "ไม่ได้ระบุเหตุผล";
        var target = parts[1];
        var label = target;

        //A character name is allowed where an address is expected, because that is what a GM
        //is actually looking at when they decide to do this.
        if (TryFindOnline(target, out var connection))
        {
            if (string.IsNullOrEmpty(connection.RemoteAddress))
            {
                Tell(player, $"ไม่ทราบไอพีของ {target} — เซิร์ฟเวอร์อาจอยู่หลัง proxy ที่ไม่ได้ส่ง header มา");
                return;
            }

            label = $"{target} ({connection.RemoteAddress})";
            target = connection.RemoteAddress;
        }

        if (target == player.Connection?.RemoteAddress)
        {
            Tell(player, "นั่นคือไอพีของคุณเอง");
            return;
        }

        var ban = BanList.BanAddress(target, label, expires, reason, player.Name);

        //Everyone on that address goes now. A ban that only bites on the next login leaves
        //the farm running until somebody decides to log out.
        var kicked = 0;
        foreach (var other in NetworkManager.SnapshotConnections())
        {
            if (!string.Equals(other.RemoteAddress, target, StringComparison.OrdinalIgnoreCase))
                continue;
            NetworkManager.QueueDisconnect(other);
            kicked++;
        }

        Tell(player, $"<color=#FF9955>แบนไอพี {target} แล้ว ({BanList.Remaining(ban)}) เตะออก {kicked} คน — {reason}</color>");

        var accounts = AddressLog.AccountsAt(target);
        if (accounts.Count > 0)
            Tell(player, $"<color=#AACCFF>ไอพีนี้เคยถูกใช้โดย {accounts.Count} บัญชี: {string.Join(", ", accounts.Take(10).Select(a => a.Name))}</color>");
    }

    private static void Unban(Player player, string[] parts)
    {
        if (parts.Length < 2)
        {
            Tell(player, "ใช้: !unban <ชื่อบัญชี>");
            return;
        }

        if (!TryFindAccountByName(parts[1], out var accountId, out var accountName))
        {
            Tell(player, $"ไม่รู้จักบัญชีชื่อ {parts[1]}");
            return;
        }

        Tell(player, BanList.LiftAccount(accountId)
            ? $"ปลดแบนบัญชี {accountName} แล้ว"
            : $"บัญชี {accountName} ไม่ได้ถูกแบนอยู่");
    }

    private static void UnbanIp(Player player, string[] parts)
    {
        if (parts.Length < 2)
        {
            Tell(player, "ใช้: !unbanip <ไอพี>");
            return;
        }

        Tell(player, BanList.LiftAddress(parts[1])
            ? $"ปลดแบนไอพี {parts[1]} แล้ว"
            : $"ไอพี {parts[1]} ไม่ได้ถูกแบนอยู่");
    }

    private static void Bans(Player player)
    {
        var active = BanList.Active();
        if (active.Count == 0)
        {
            Tell(player, "ตอนนี้ไม่มีใครถูกแบน");
            return;
        }

        Tell(player, $"<color=#FFCC55>แบนอยู่ {active.Count} รายการ</color>");

        var shown = 0;
        foreach (var ban in active)
        {
            if (shown >= MaxLines)
            {
                Tell(player, $"...และอีก {active.Count - shown} รายการ");
                break;
            }

            var who = ban.Address.Length > 0 ? $"ไอพี {ban.Address}" : $"บัญชี {ban.AccountName}";
            Tell(player, $"  {who}  ·  {BanList.Remaining(ban)}  ·  {ban.Reason}  (โดย {ban.BannedBy})");
            shown++;
        }
    }

    // ---------------------------------------------------------------- odds and ends

    /// <summary>
    /// 30m, 2h, 7d, or perm. Anything else is refused rather than guessed at: a ban is the
    /// one command where reading "7" as seven minutes instead of seven days matters.
    /// </summary>
    private static bool TryParseDuration(string text, out DateTime expiresAt)
    {
        expiresAt = Forever;

        if (string.IsNullOrWhiteSpace(text))
            return false;

        text = text.Trim().ToLowerInvariant();
        if (text is "perm" or "permanent" or "forever")
            return true;

        var unit = text[^1];
        if (!int.TryParse(text[..^1], out var amount) || amount <= 0)
            return false;

        var span = unit switch
        {
            'm' => TimeSpan.FromMinutes(amount),
            'h' => TimeSpan.FromHours(amount),
            'd' => TimeSpan.FromDays(amount),
            _ => TimeSpan.Zero
        };

        if (span == TimeSpan.Zero)
            return false;

        expiresAt = DateTime.UtcNow + span;
        return true;
    }

    private static bool TryFindOnline(string characterName, out NetworkConnection connection)
    {
        connection = null!;

        if (!World.Instance.TryFindPlayerByName(characterName, out var entity))
            return false;
        if (!entity.TryGet<Player>(out var found) || found.Connection == null)
            return false;

        connection = found.Connection;
        return true;
    }

    private static bool TryFindConnectionForAccount(int accountId, out NetworkConnection? connection)
    {
        connection = NetworkManager.SnapshotConnections().FirstOrDefault(c => c.AccountId == accountId);
        return connection != null;
    }

    /// <summary>
    /// An account by the name it logs in under, out of the addresses already seen.
    /// </summary>
    /// <remarks>
    /// Answered from memory rather than from the account table, because this runs on the
    /// world thread where a database read would have to be awaited and the answer would
    /// arrive after the command had finished. The cost is that an account that has never
    /// logged in since the server was built is not findable, which for a ban is not a case
    /// that comes up.
    /// </remarks>
    private static bool TryFindAccountByName(string accountName, out int accountId, out string name)
    {
        foreach (var connection in NetworkManager.SnapshotConnections())
        {
            if (!string.Equals(connection.AccountName, accountName, StringComparison.OrdinalIgnoreCase))
                continue;

            accountId = connection.AccountId;
            name = connection.AccountName;
            return true;
        }

        return AddressLog.TryFindAccount(accountName, out accountId, out name);
    }

    private static void Tell(Player player, string message)
    {
        if (player.Connection == null)
            return;

        CommandBuilder.AddRecipient(player.Connection);
        CommandBuilder.SendServerMessage(message, "");
        CommandBuilder.ClearRecipients();
    }
}
