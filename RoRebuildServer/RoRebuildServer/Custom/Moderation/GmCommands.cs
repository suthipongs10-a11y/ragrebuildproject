using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.Logging;
using System.Linq;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation;
using RoRebuildServer.Simulation.Enchanting;

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
            case "!ench":
            case "!enchshow":
            case "!enchclear":
            case "!enchroll":
            case "!enchodds":
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
            case "!ench": Enchant(player, parts); break;
            case "!enchshow": EnchantShow(player, parts); break;
            case "!enchclear": EnchantClear(player, parts); break;
            case "!enchroll": EnchantRoll(player, parts); break;
            case "!enchodds": EnchantOdds(player, parts); break;
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
        Tell(player, "<color=#FFCC55>คำสั่งทดสอบระบบคัมภีร์</color>");
        Tell(player, "!ench <ช่อง> <tier> <สเตตัส> <ค่า> [สเตตัส ค่า] [สเตตัส ค่า]");
        Tell(player, "!enchshow <ช่อง> · !enchclear <ช่อง>");
        Tell(player, "!enchroll <ช่อง> <tier> — สุ่มจริงตามตาราง");
        Tell(player, "!enchodds <ช่อง> <tier> [จำนวน] — ลองสุ่มเปล่า ๆ ดูการกระจาย");
        Tell(player, "<color=#AACCFF>ช่อง: weapon shield body headtop headmid headbottom garment footgear accessory1 accessory2</color>");
        Tell(player, "<color=#AACCFF>tier: 1 ดิน · 2 ฟ้า · 3 สวรรค์ · 4 ตำนาน</color>");
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

    // ---------------------------------------------------------------- enchant test bench

    /// <summary>
    /// Puts a block of options on whatever is in an equip slot.
    /// </summary>
    /// <remarks>
    /// A GM command rather than a script command because the scrolls do not exist yet and
    /// this needs to be testable before they do. Everything past the parsing goes through
    /// the same two calls the scroll will use, so what is proven here is the real path and
    /// not a shortcut around it.
    ///
    /// It writes the options verbatim - no rolling, no tier limits, no duplicate check. A
    /// bench that enforced the design rules could not be used to test what happens when
    /// they are broken.
    /// </remarks>
    private static void Enchant(Player player, string[] parts)
    {
        //!ench <slot> <tier> <stat> <value> [stat value] [stat value]
        if (parts.Length < 5 || parts.Length % 2 == 0)
        {
            Tell(player, "ใช้: !ench <ช่อง> <tier 1-4> <สเตตัส> <ค่า> [สเตตัส ค่า] [สเตตัส ค่า]");
            Tell(player, "<color=#AACCFF>ตัวอย่าง: !ench weapon 2 AddStr 3 AddAttackPower 6</color>");
            return;
        }

        if (!TryFindWornItem(player, parts[1], out var slot, out var uniqueId, out var itemName))
            return;

        if (!int.TryParse(parts[2], out var tierNumber) || tierNumber < 1 || tierNumber > 4)
        {
            Tell(player, "tier ต้องเป็น 1 ถึง 4 (ดิน ฟ้า สวรรค์ ตำนาน)");
            return;
        }

        var enchant = new ItemEnchant((EnchantTier)tierNumber);

        for (var i = 3; i + 1 < parts.Length; i += 2)
        {
            if (!System.Enum.TryParse<CharacterStat>(parts[i], true, out var stat))
            {
                Tell(player, $"ไม่รู้จักสเตตัสชื่อ {parts[i]}");
                return;
            }

            if (!int.TryParse(parts[i + 1], out var value) || value == 0)
            {
                Tell(player, $"ค่าของ {parts[i]} ต้องเป็นตัวเลขที่ไม่ใช่ศูนย์");
                return;
            }

            if (!enchant.Add(stat, value))
            {
                Tell(player, $"ใส่ได้ไม่เกิน {ItemEnchant.MaxOptions} ออพต่อชิ้น");
                return;
            }
        }

        EnchantRegistry.Record(uniqueId, enchant);
        EnchantSystem.RefreshIfWorn(player, uniqueId);
        CommandBuilder.SendForgedNameForId(player, uniqueId); //so the tooltip reads it too

        Tell(player, $"<color=#55FF55>ใส่ออพให้ {itemName} ({slot}) แล้ว</color>");
        DescribeEnchant(player, enchant);
        ServerLogger.Log($"[Enchant] {player.Name} set {enchant.Count} option(s) on their {slot} item.");
    }

    private static void EnchantShow(Player player, string[] parts)
    {
        if (parts.Length < 2)
        {
            Tell(player, "ใช้: !enchshow <ช่อง>");
            return;
        }

        if (!TryFindWornItem(player, parts[1], out var slot, out var uniqueId, out var itemName))
            return;

        if (!EnchantRegistry.TryGet(uniqueId, out var enchant))
        {
            Tell(player, $"{itemName} ({slot}) ยังไม่มีออพ");
            return;
        }

        Tell(player, $"<color=#FFCC55>{itemName} ({slot})</color>");
        DescribeEnchant(player, enchant);
    }

    private static void EnchantClear(Player player, string[] parts)
    {
        if (parts.Length < 2)
        {
            Tell(player, "ใช้: !enchclear <ช่อง>");
            return;
        }

        if (!TryFindWornItem(player, parts[1], out var slot, out var uniqueId, out var itemName))
            return;

        if (!EnchantRegistry.IsEnchanted(uniqueId))
        {
            Tell(player, $"{itemName} ({slot}) ไม่มีออพให้ล้างอยู่แล้ว");
            return;
        }

        EnchantRegistry.Clear(uniqueId);
        EnchantSystem.RefreshIfWorn(player, uniqueId);
        CommandBuilder.SendEnchantCleared(player, uniqueId);
        Tell(player, $"<color=#55FF55>ล้างออพของ {itemName} ({slot}) แล้ว</color>");
    }

    /// <summary>
    /// Rolls a scroll of the given tier onto whatever is in a slot, for real.
    /// </summary>
    /// <remarks>
    /// The same call the scroll itself will make once the scroll exists, so what is being
    /// tested here is the shipping path rather than a rehearsal of it. Unlike !ench this
    /// obeys every rule in the tables: the slot decides the pool, the tier decides the
    /// values, and an attempt is allowed to come up with nothing.
    /// </remarks>
    private static void EnchantRoll(Player player, string[] parts)
    {
        if (parts.Length < 3)
        {
            Tell(player, "ใช้: !enchroll <ช่อง> <tier 1-4>");
            return;
        }

        if (!TryFindWornItem(player, parts[1], out var slot, out var uniqueId, out var itemName))
            return;

        if (!TryReadTier(player, parts[2], out var tier))
            return;

        var family = EnchantTables.FamilyOf(ItemIdInSlot(player, slot));
        if (family == EnchantSlotFamily.None)
        {
            Tell(player, $"{itemName} ไม่ใช่ของที่ใส่ออพได้");
            return;
        }

        var enchant = EnchantTables.Roll(tier, family);

        EnchantRegistry.Record(uniqueId, enchant);
        EnchantSystem.RefreshIfWorn(player, uniqueId);

        if (enchant.Count == 0)
        {
            CommandBuilder.SendEnchantCleared(player, uniqueId);
            Tell(player, $"<color=#FF5555>คัมภีร์สลายไปเปล่า ๆ</color> {itemName} ไม่ได้ออพสักตัว");
            return;
        }

        CommandBuilder.SendForgedNameForId(player, uniqueId);
        Tell(player, $"<color=#55FF55>สุ่มออพให้ {itemName} ({slot}) แล้ว</color> — พูล {family}");
        DescribeEnchant(player, enchant);
    }

    /// <summary>
    /// Rolls a great many scrolls without touching anything, and reports what came out.
    /// </summary>
    /// <remarks>
    /// The only honest way to check odds. A handful of rolls in game tells nobody whether
    /// fifteen percent is really fifteen percent, and the alternative to this is a player
    /// noticing over a month that something is off.
    /// </remarks>
    private static void EnchantOdds(Player player, string[] parts)
    {
        if (parts.Length < 3)
        {
            Tell(player, "ใช้: !enchodds <ช่อง> <tier 1-4> [จำนวน]");
            return;
        }

        if (!TryFindWornItem(player, parts[1], out var slot, out _, out var itemName))
            return;

        if (!TryReadTier(player, parts[2], out var tier))
            return;

        var samples = 1000;
        if (parts.Length > 3 && (!int.TryParse(parts[3], out samples) || samples < 1 || samples > 100000))
        {
            Tell(player, "จำนวนต้องอยู่ระหว่าง 1 ถึง 100000");
            return;
        }

        var family = EnchantTables.FamilyOf(ItemIdInSlot(player, slot));
        if (family == EnchantSlotFamily.None)
        {
            Tell(player, $"{itemName} ไม่ใช่ของที่ใส่ออพได้");
            return;
        }

        var attempts = EnchantTables.AttemptsFor(tier);
        var blanks = 0;
        var full = 0;
        var options = 0;
        var perStat = new Dictionary<CharacterStat, (int Count, int Total, int Min, int Max)>();

        for (var i = 0; i < samples; i++)
        {
            var rolled = EnchantTables.Roll(tier, family);
            if (rolled.Count == 0)
                blanks++;
            if (rolled.Count == attempts)
                full++;

            options += rolled.Count;

            for (var j = 0; j < rolled.Count; j++)
            {
                var opt = rolled.Options[j];
                if (!perStat.TryGetValue(opt.Stat, out var cur))
                    cur = (0, 0, int.MaxValue, int.MinValue);

                perStat[opt.Stat] = (cur.Count + 1, cur.Total + opt.Value,
                    int.Min(cur.Min, opt.Value), int.Max(cur.Max, opt.Value));
            }
        }

        var (empty, curve) = EnchantTables.OddsFor(tier);

        Tell(player, $"<color=#FFCC55>สุ่ม {samples:N0} ครั้ง · ระดับ {tier} · พูล {family}</color>");
        Tell(player, $"ตั้งไว้: ช่องว่าง {empty / 100f:0.#}% · ความชันค่า {curve:0.0} · {attempts} ช่องต่อใบ");
        Tell(player, $"<color=#AACCFF>ด่านที่ 1 — ได้ครบทุกช่อง</color> {(double)full / samples * 100:0.0}%  (ว่างทั้งใบ {(double)blanks / samples * 100:0.00}%)");
        Tell(player, $"เฉลี่ย {(double)options / samples:0.00} ออพต่อใบ จากเต็ม {attempts}");
        Tell(player, "<color=#AACCFF>ด่านที่ 2 — ค่าที่ได้</color>");

        foreach (var (stat, data) in perStat.OrderByDescending(e => e.Value.Count))
            Tell(player, $"  {stat,-22} {(double)data.Count / options * 100,4:0.0}% · ได้ {data.Min}~{data.Max} เฉลี่ย {(double)data.Total / data.Count:0.00}");
    }

    private static int ItemIdInSlot(Player player, EquipSlot slot) => player.Equipment.ItemIds[(int)slot];

    private static bool TryReadTier(Player player, string text, out EnchantTier tier)
    {
        tier = EnchantTier.None;

        if (!int.TryParse(text, out var number) || number < 1 || number > 4)
        {
            Tell(player, "tier ต้องเป็น 1 ถึง 4 (ดิน ฟ้า สวรรค์ ตำนาน)");
            return false;
        }

        tier = (EnchantTier)number;
        return true;
    }

    /// <summary>
    /// Turns a slot name into the item worn there, complaining to the GM if it cannot.
    /// </summary>
    /// <remarks>
    /// The guid is what everything downstream wants, and an item that has never been given
    /// one cannot be enchanted at all - the options would have nothing to hang off. That is
    /// worth saying out loud rather than failing quietly, because it is exactly the sort of
    /// thing an old test character has lying in its bag.
    /// </remarks>
    private static bool TryFindWornItem(Player player, string slotName, out EquipSlot slot, out Guid uniqueId, out string itemName)
    {
        slot = EquipSlot.None;
        uniqueId = Guid.Empty;
        itemName = "";

        //ItemSlots is ten long and EquipSlot runs past that - the costume slots and the
        //ammunition slot are kept elsewhere. Parsing one of those names and indexing with
        //it would read off the end of the array, so the range is checked and not just the
        //name.
        if (!System.Enum.TryParse(slotName, true, out slot) || (int)slot < 0 || (int)slot >= 10)
        {
            Tell(player, $"ไม่รู้จักช่องชื่อ {slotName}");
            slot = EquipSlot.None;
            return false;
        }

        var inventory = player.Inventory;
        var bagId = player.Equipment.ItemSlots[(int)slot];

        if (inventory == null || bagId <= 0 || !inventory.GetItem(bagId, out var item))
        {
            Tell(player, $"ช่อง {slot} ไม่ได้ใส่อะไรอยู่");
            return false;
        }

        uniqueId = EnchantSystem.GuidOf(ref item);
        if (uniqueId == Guid.Empty)
        {
            Tell(player, $"ของในช่อง {slot} ไม่มี guid ประจำชิ้น ใส่ออพไม่ได้");
            return false;
        }

        itemName = DataManager.ItemList.TryGetValue(item.Id, out var data) ? data.Code : item.Id.ToString();
        return true;
    }

    private static void DescribeEnchant(Player player, ItemEnchant enchant)
    {
        Tell(player, $"<color=#AACCFF>ระดับ {enchant.Tier} · {enchant.Count} ออพ</color>");

        for (var i = 0; i < enchant.Count; i++)
            Tell(player, $"  {enchant.Options[i].Stat} +{enchant.Options[i].Value}");
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
