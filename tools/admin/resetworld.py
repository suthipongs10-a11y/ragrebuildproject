#!/usr/bin/env python3
"""Start the world over: delete every character and everything they own, keep the logins.

    python3 resetworld.py DB                  look only, nothing is changed
    python3 resetworld.py DB --apply          back up, wipe, check

DB is RoCharacterDatabase.db (on the VPS: /opt/rorebuild/server/RoCharacterDatabase.db).

Kept, always: every login account and what hangs off it - the password, the roles, the GM
name, the remember-me token. A GM stays a GM because that is decided by the account name.

Wiped, always: the characters, and with them their bags, worn gear, skills, zeny, quest flags,
adventure book and boss log, because all of that is stored inside the character row. Also the
Kafra storage and its zeny, the parcel box, auctions, buy orders, the forge and enchant
records, friends, parties and guilds. Nothing that can hold an item is left behind.

Wiped unless --keep-globals: ScriptGlobals, the server-wide progress behind the milestone
boards - the top ten levels, who reached each level first, who killed each boss first (all
by character name), and whether Okolnir has been cleared. Wiping it empties the boards and
makes the one-time first-kill rewards claimable again, which is what "start over" means.
The camp's NPCs do not depend on it: this server shows them from the first boot (see
EventRevealedNpc in Script/Event/MilestoneEvent.txt). --keep-globals leaves the boards
standing, with the names of characters that no longer exist on them.

Kept unless asked: the ban list (--wipe-bans) and the address history (--wipe-addresses).
A reset is not a pardon.

Stop the server first (systemctl stop rorebuild). With --apply this refuses to run while the
service is active or anything else has the file open, copies the database to
BeforeReset-RoCharacterDatabase-<time>.db.gz and checks the copy before it deletes a row, does
the deleting in one transaction, and rolls back if the counts afterwards are not what they
should be. The copy is named so the 14 day cleanup of the six hourly backups leaves it alone.
Restoring it is the same as restoring any backup: gunzip it over the database file.
"""
import argparse
import datetime
import gzip
import os
import shutil
import signal
import sqlite3
import subprocess
import sys

# Never touched by any flag. Here so the preview can say what stays.
ACCOUNT_TABLES = ["DbUserAccount", "DbRoles", "DbUserRoles", "DbUserClaims", "DbUserLogins", "DbUserTokens", "DbRoleClaims"]

# Always wiped. The order matters once: Character points at Party, so it goes first.
WIPE = [
    ("Character", "ตัวละคร (ของในกระเป๋า ของที่สวม สกิล เซนี่ ธงเควส สมุดผจญภัย อยู่ในแถวตัวละครเอง)"),
    ("Party", "ปาร์ตี้"),
    ("Guild", "กิลด์"),
    ("StorageInventory", "คลัง Kafra และเซนี่ในคลัง"),
    ("InboxParcel", "พัสดุที่ยังไม่ได้รับ"),
    ("Auction", "ของที่ลงประมูลไว้"),
    ("AuctionBid", "ประวัติการบิด"),
    ("BuyOrder", "ใบสั่งซื้อ (เงินที่กันไว้)"),
    ("ForgedItem", "บันทึกว่าใครตีอาวุธ"),
    ("EnchantedItem", "บันทึกออปชั่นที่ enchant"),
    ("Friend", "รายชื่อเพื่อน"),
]

GLOBALS = ("ScriptGlobals", "กระดานหมุดหมาย (10 อันดับเลเวล คนแรกที่ถึงเลเวล/ล้มบอส และรางวัลคนแรก)")
BANS = ("Ban", "รายการแบน")
ADDRESSES = ("AccountAddress", "ประวัติไอพีของบัญชี")

# EF Core's own bookkeeping, and SQLite's (sqlite_sequence and friends are matched by prefix).
PLUMBING = {"__EFMigrationsHistory"}

LIST_LIMIT = 40


def tables_in(con):
    return [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]


def count(con, table):
    return con.execute('SELECT COUNT(*) FROM "%s"' % table).fetchone()[0]


def size_text(path):
    n = os.path.getsize(path)
    return "%.1f MB" % (n / 1024 / 1024) if n >= 1024 * 1024 else "%.0f KB" % (n / 1024)


class Plan:
    def __init__(self, present, args):
        wipe = list(WIPE)
        kept_optional = []
        for entry, wiped in ((GLOBALS, not args.keep_globals), (BANS, args.wipe_bans), (ADDRESSES, args.wipe_addresses)):
            (wipe if wiped else kept_optional).append(entry)

        self.wipe = [e for e in wipe if e[0] in present]
        self.kept = [t for t in ACCOUNT_TABLES if t in present] + [e[0] for e in kept_optional if e[0] in present]
        self.kept_notes = {e[0]: e[1] for e in kept_optional}

        known = set(ACCOUNT_TABLES) | {e[0] for e in wipe} | {e[0] for e in kept_optional} | PLUMBING
        self.unknown = [t for t in present if t not in known and not t.startswith("sqlite_")]


def show(con, plan, db):
    print("ฐานข้อมูล  %s  (%s)" % (db, size_text(db)))
    print()

    accounts = count(con, "DbUserAccount")
    print("เก็บไว้")
    print("  %-18s %6d  บัญชีล็อกอิน (รหัสผ่านและสิทธิ์ GM เหมือนเดิม)" % ("DbUserAccount", accounts))
    for table in plan.kept:
        if table == "DbUserAccount":
            continue
        n = count(con, table)
        if table in plan.kept_notes:
            print("  %-18s %6d  %s" % (table, n, plan.kept_notes[table]))
        elif n:
            print("  %-18s %6d  (ตารางของระบบบัญชี)" % (table, n))
    print()

    print("จะลบ")
    for table, note in plan.wipe:
        print("  %-18s %6d  %s" % (table, count(con, table), note))

    if "StorageInventory" in {t for t, _ in plan.wipe}:
        zeny = con.execute("SELECT COALESCE(SUM(StorageZeny), 0) FROM StorageInventory").fetchone()[0]
        print()
        print("  เงินในคลังรวมที่จะหายไป %s z (เงินในตัวละครอยู่ในแถวตัวละคร ไม่ได้รวมไว้ตรงนี้)" % format(zeny, ","))

    if "Character" in {t for t, _ in plan.wipe}:
        rows = con.execute(
            "SELECT a.UserName, c.Name, c.Map FROM Character c LEFT JOIN DbUserAccount a ON a.Id = c.AccountId "
            "ORDER BY a.UserName COLLATE NOCASE, c.CharacterSlot").fetchall()
        if rows:
            print()
            print("ตัวละครที่จะหายไป (ไอดี / ตัวละคร / แมพ)")
            for login, name, map_name in rows[:LIST_LIMIT]:
                print("  %-20s %-26s %s" % (login or "(ไม่พบบัญชี)", name, map_name or "-"))
            if len(rows) > LIST_LIMIT:
                print("  ... และอีก %d ตัว" % (len(rows) - LIST_LIMIT))

    if plan.unknown:
        print()
        print("พบตารางที่สคริปต์นี้ไม่รู้จัก (ไม่แตะ): %s" % ", ".join(plan.unknown))
        print("ถ้าตารางพวกนี้เก็บของหรือตัวละคร ให้เพิ่มลงใน WIPE ก่อน แล้วค่อยรัน --apply")


def service_running(name):
    # Where there is no systemd (a Windows PC, a container) the exclusive lock below is the check.
    if not shutil.which("systemctl"):
        return False
    quiet = subprocess.DEVNULL
    return subprocess.run(["systemctl", "is-active", "--quiet", name], stdout=quiet, stderr=quiet).returncode == 0


def open_exclusive(path):
    """Opens the file in a way that only works if nobody else has it open, and keeps it that way."""
    con = sqlite3.connect(path, timeout=1, isolation_level=None)
    con.execute("PRAGMA locking_mode=EXCLUSIVE")
    # Takes the lock now rather than at the first delete, so a server that is still running
    # is found before anything has been copied or touched. Exclusive mode keeps it afterwards.
    con.execute("BEGIN EXCLUSIVE")
    con.execute("COMMIT")
    return con


def backup(con, db, folder, present):
    os.makedirs(folder, exist_ok=True)
    needed = os.path.getsize(db) * 2 + 1024 * 1024
    free = shutil.disk_usage(folder).free
    if free < needed:
        sys.exit("พื้นที่ว่างใน %s ไม่พอสำรอง (ว่าง %.0f MB ต้องการประมาณ %.0f MB) ยังไม่ได้ลบอะไร" % (folder, free / 1048576, needed / 1048576))

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    plain = os.path.join(folder, "BeforeReset-RoCharacterDatabase-%s.db" % stamp)
    target = sqlite3.connect(plain)
    con.backup(target)
    target.close()

    # A copy that has not been read back is a hope, not a backup. Opened normally rather than
    # read only: a read only connection to a WAL file can leave its -wal and -shm behind.
    check = sqlite3.connect(plain)
    verdict = check.execute("PRAGMA integrity_check").fetchone()[0]
    if verdict != "ok":
        sys.exit("ไฟล์สำรองตรวจแล้วไม่ผ่าน (%s) ยังไม่ได้ลบอะไร ไฟล์ที่เสียอยู่ที่ %s" % (verdict, plain))
    for table in present:
        copied = count(check, table)
        original = count(con, table)
        if copied != original:
            sys.exit("ไฟล์สำรองตาราง %s มี %d แถว แต่ของจริงมี %d ยังไม่ได้ลบอะไร" % (table, copied, original))
    check.close()
    for suffix in ("-wal", "-shm"):
        if os.path.exists(plain + suffix):
            os.remove(plain + suffix)

    packed = plain + ".gz"
    with open(plain, "rb") as src, gzip.open(packed, "wb") as dst:
        shutil.copyfileobj(src, dst)
    os.remove(plain)
    os.chmod(packed, 0o600)  # it holds every password hash
    return packed


def verify(con, plan, before):
    problems = []
    for table, _ in plan.wipe:
        left = count(con, table)
        if left:
            problems.append("%s ยังเหลือ %d แถว" % (table, left))
    for table in plan.kept:
        now = count(con, table)
        if now != before[table]:
            problems.append("%s จำนวนแถวเปลี่ยนจาก %d เป็น %d ทั้งที่ควรเก็บไว้" % (table, before[table], now))
    broken = con.execute("PRAGMA foreign_key_check").fetchall()
    if broken:
        problems.append("foreign key ผิดปกติ %d จุด" % len(broken))
    return problems


def wipe(con, plan, before):
    # Not changeable inside a transaction, so it is set first.
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("BEGIN IMMEDIATE")
    try:
        for table, _ in plan.wipe:
            con.execute('DELETE FROM "%s"' % table)
        # ids that players can see (auction numbers, party ids) start from 1 again
        if "sqlite_sequence" in tables_in(con):
            for table, _ in plan.wipe:
                con.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table,))

        problems = verify(con, plan, before)
        if problems:
            con.execute("ROLLBACK")
            sys.exit("ผลหลังลบไม่ตรงที่ควรเป็น เลยยกเลิกทั้งหมด (ฐานข้อมูลเหมือนก่อนรัน):\n  " + "\n  ".join(problems))
        con.execute("COMMIT")
    except BaseException:
        try:
            con.execute("ROLLBACK")
        except sqlite3.Error:
            pass  # already finished
        raise


def owner_text(owner):
    """user:group by name where the system can say it, else by number."""
    try:
        import grp
        import pwd
        return "%s:%s" % (pwd.getpwuid(owner.st_uid).pw_name, grp.getgrgid(owner.st_gid).gr_name)
    except (ImportError, KeyError):
        return "%d:%d" % (owner.st_uid, owner.st_gid)


def hand_back(db, owner):
    """Run as root, the files SQLite makes would be root's and the service could not open them."""
    if not hasattr(os, "geteuid") or os.geteuid() != 0:
        return
    for suffix in ("", "-wal", "-shm"):
        path = db + suffix
        if os.path.exists(path):
            now = os.stat(path)
            if (now.st_uid, now.st_gid) != (owner.st_uid, owner.st_gid):
                os.chown(path, owner.st_uid, owner.st_gid)


def apply(args, plan, db):
    if service_running(args.service):
        sys.exit("เซิร์ฟเวอร์ยังรันอยู่ ให้หยุดก่อนด้วย: systemctl stop %s  (ยังไม่ได้ลบอะไร)" % args.service)
    if plan.unknown and not args.allow_unknown:
        sys.exit("มีตารางที่สคริปต์ไม่รู้จัก (%s) ไม่กล้าลบโดยไม่รู้ว่าเก็บอะไร ถ้าตรวจแล้วว่าปล่อยไว้ได้ ใส่ --allow-unknown" % ", ".join(plan.unknown))

    owner = os.stat(db)
    try:
        con = open_exclusive(db)
    except sqlite3.OperationalError as e:
        sys.exit("เปิดฐานข้อมูลแบบผูกขาดไม่ได้ (%s) แปลว่ามีโปรแกรมอื่นเปิดไฟล์อยู่ ปกติคือเซิร์ฟเวอร์ยังไม่ได้หยุด ยังไม่ได้ลบอะไร" % e)

    mode = con.execute("PRAGMA journal_mode").fetchone()[0]
    present = [t for t in tables_in(con) if not t.startswith("sqlite_")]
    before = {t: count(con, t) for t in present}

    folder = args.backup_dir
    if not folder:
        sibling = os.path.join(os.path.dirname(os.path.dirname(db)), "backup")  # /opt/rorebuild/backup
        folder = sibling if os.path.isdir(sibling) else os.path.join(os.path.dirname(db), "backup")

    print("สำรองข้อมูลก่อน ...")
    packed = backup(con, db, folder, present)
    print("  สำรองและตรวจแล้ว: %s (%s)" % (packed, size_text(packed)))
    print()

    print("ลบ ...")
    wipe(con, plan, before)
    print("  ลบแล้วในคราวเดียว ตรวจจำนวนแถวและ foreign key ผ่าน")

    # Gives the freed pages back so the file shrinks. Nothing depends on it.
    try:
        con.execute("VACUUM")
    except sqlite3.Error as e:
        print("  (VACUUM ไม่สำเร็จ ข้ามไป ไม่มีผลกับข้อมูล: %s)" % e)

    verdict = con.execute("PRAGMA integrity_check").fetchone()[0]
    if verdict != "ok":
        sys.exit("integrity_check หลังลบได้ '%s' ให้กู้จากไฟล์สำรอง %s" % (verdict, packed))
    if con.execute("PRAGMA journal_mode").fetchone()[0] != mode:
        con.execute("PRAGMA journal_mode=%s" % mode)  # a restart would work either way, this keeps the file as it was

    print()
    print("หลังรีเซ็ต")
    print("  บัญชีล็อกอิน %d บัญชี (ก่อนหน้า %d)  ตัวละคร %d  ของในคลัง/พัสดุ/ประมูล 0" % (
        count(con, "DbUserAccount"), before["DbUserAccount"], count(con, "Character")))
    con.close()
    hand_back(db, owner)

    print()
    print("เสร็จแล้ว สั่งเปิดเซิร์ฟเวอร์ได้: systemctl start %s" % args.service)
    print("ถ้าอยากย้อนกลับ (หยุดเซิร์ฟเวอร์ก่อน):")
    print("  gunzip -c %s > %s" % (packed, db))
    print("  rm -f %s-wal %s-shm" % (db, db))
    print("  chown %s %s" % (owner_text(owner), db))


def main():
    # Thai on a Windows console, and a closed pipe (| head) that is not an error.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("db", help="path to RoCharacterDatabase.db")
    ap.add_argument("--apply", action="store_true", help="really do it; without this nothing is changed")
    ap.add_argument("--keep-globals", action="store_true", help="keep ScriptGlobals (the milestone boards and the one-time first-kill records)")
    ap.add_argument("--wipe-bans", action="store_true", help="also clear the ban list")
    ap.add_argument("--wipe-addresses", action="store_true", help="also clear the address history")
    ap.add_argument("--allow-unknown", action="store_true", help="go ahead although the database has tables this script does not know")
    ap.add_argument("--backup-dir", help="where the BeforeReset copy goes (default: ../backup next to the server folder, else beside the database)")
    ap.add_argument("--service", default="rorebuild", help="systemd service that must not be running (default: rorebuild)")
    args = ap.parse_args()

    db = os.path.abspath(args.db)
    if not os.path.isfile(db):
        sys.exit("ไม่พบไฟล์ " + db)

    # Looking never needs more than a read only connection, and works with the server running.
    # A read only connection to a WAL file leaves its -wal and -shm behind when it closes if it
    # was the one that made them, and files made by root would lock the service out of its own
    # database later - so whatever it made, it clears.
    had = {suffix: os.path.exists(db + suffix) for suffix in ("-wal", "-shm")}
    look = sqlite3.connect("file:%s?mode=ro" % db, uri=True)
    try:
        present = [t for t in tables_in(look) if not t.startswith("sqlite_")]
        if "DbUserAccount" not in present or "Character" not in present:
            sys.exit("นี่ไม่ใช่ฐานข้อมูลของเซิร์ฟเวอร์นี้ (ไม่มีตาราง DbUserAccount หรือ Character)")
        plan = Plan(present, args)
        show(look, plan, db)
    finally:
        look.close()
        for suffix, existed in had.items():
            if not existed and os.path.exists(db + suffix):
                os.remove(db + suffix)
    print()

    if not args.apply:
        print("นี่แค่ดูเฉย ๆ ยังไม่ได้ลบอะไร ถ้าตรงที่ต้องการ หยุดเซิร์ฟเวอร์ แล้วรันซ้ำพร้อม --apply")
        return

    apply(args, plan, db)


if __name__ == "__main__":
    main()
