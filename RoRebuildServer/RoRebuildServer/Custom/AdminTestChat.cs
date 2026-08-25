using RoRebuildServer.EntityComponents;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Custom;

/// <summary>
/// A couple of switches for testing, typed rather than clicked.
/// </summary>
/// <remarks>
/// Hung off ordinary chat for the same reason the adventure book is: a packet of its own
/// lives in RebuildSharedData, which the client only sees once updateclient.bat has copied
/// the dll across. A line of chat works against a client nobody rebuilt, and can be added
/// and taken away without touching the client at all.
///
/// Refused to anybody who is not an admin, which on a live server is everybody: IsAdmin is
/// read from UseDebugMode, and that is false in appsettings.Production.json.
/// </remarks>
public static class AdminTestChat
{
    private const string OneHitCommand = "!onehit";

    /// <summary>Answers the message if it was for us, and says whether it was.</summary>
    public static bool TryHandle(Player player, string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return false;

        var command = text.Trim();
        if (!command.Equals(OneHitCommand, StringComparison.OrdinalIgnoreCase))
            return false;

        if (!player.IsAdmin)
        {
            //Answered rather than ignored, so it does not get broadcast as ordinary chat.
            CommandBuilder.ErrorMessage(player, "คำสั่งนี้ใช้ได้เฉพาะแอดมิน");
            return true;
        }

        var combat = player.CombatEntity;
        combat.OneHitKill = !combat.OneHitKill;

        Tell(player, combat.OneHitKill
            ? "<color=#FF9955>เปิดโหมดทดสอบ: ตีโดนมอนครั้งเดียวตาย (ดรอป EXP สมุดผจญภัย บันทึกล่าจอมมาร ทำงานตามปกติทุกอย่าง) พิมพ์ !onehit อีกครั้งเพื่อปิด</color>"
            : "<color=#FF9955>ปิดโหมดทดสอบ: ตีมอนตามค่าพลังจริงแล้ว</color>");

        return true;
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
