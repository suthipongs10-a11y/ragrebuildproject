#!/usr/bin/env python3
"""Look a character up in the server's SQLite database. Read only.

Why this exists: a character's zeny is not a column. It is one of the numbers inside the
LZ4 compressed Data blob the server saves, so a plain sqlite3 query can tell you which
account owns "Name" but not how much money they are carrying. This reads the blob the same
way the server does (PlayerDataDbHelper: an int16 count, then that many int32 stats, in the
order of the PlayerStat enum).

    python3 findchar.py DB NAME          one character: owner account, zeny, shared addresses
    python3 findchar.py DB NAME --parcels   ...and the zeny parcels sent to them
    python3 findchar.py DB --top 15      the richest characters, to see who is an outlier

DB is RoCharacterDatabase.db, or a gunzipped copy of one of the backups in
/opt/rorebuild/backup/. The file is opened read only, so pointing it at the live database
while the server runs is safe. Run it over several backups to see when a balance jumped.

It prints the login name (UserName) of the owning account, never the password hash.
"""
import os
import signal
import sqlite3
import statistics
import struct
import sys

# Positions in the stat array, from PlayerStat in RebuildSharedData/Enum/EntityStats/StatEnums.cs.
LEVEL, JOB, ZENY, JOB_LEVEL = 0, 5, 18, 19


def lz4_block_decode(src, size):
    """LZ4 block format, which is what K4os LZ4Codec.Encode writes (no frame header)."""
    out = bytearray()
    i, n = 0, len(src)
    while i < n:
        token = src[i]
        i += 1
        literals = token >> 4
        if literals == 15:
            while True:
                b = src[i]
                i += 1
                literals += b
                if b != 255:
                    break
        out += src[i:i + literals]
        i += literals
        if i >= n:
            break  # the last sequence carries literals only
        offset = src[i] | (src[i + 1] << 8)
        i += 2
        match = token & 15
        if match == 15:
            while True:
                b = src[i]
                i += 1
                match += b
                if b != 255:
                    break
        match += 4
        start = len(out) - offset
        for k in range(match):  # may overlap its own output, so copy one byte at a time
            out.append(out[start + k])
    return bytes(out[:size])


def read_stats(data, length):
    if not data:
        return []
    raw = lz4_block_decode(bytes(data), length)
    (count,) = struct.unpack_from("<h", raw, 0)
    count = min(count, (len(raw) - 2) // 4)
    return list(struct.unpack_from("<%di" % count, raw, 2))


def stat(stats, index):
    return stats[index] if index < len(stats) else 0


def job_names():
    """Job id -> name, from Jobs.csv if it can be found next to a repo or a deployed server."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "..", "..", "RoRebuildServer", "GameConfig", "ServerData", "Db", "Jobs.csv"),
        "/opt/rorebuild/server/ServerData/Db/Jobs.csv",
    ]
    for path in candidates:
        if os.path.exists(path):
            names = {}
            with open(path, encoding="utf-8-sig") as f:
                next(f, None)
                for line in f:
                    parts = line.rstrip("\n").split(",")
                    if len(parts) > 1 and parts[0].isdigit():
                        names[int(parts[0])] = parts[1]
            return names
    return {}


def money(n):
    return "{:,}z".format(n)


class Db:
    def __init__(self, path):
        if not os.path.exists(path):
            sys.exit("ไม่พบไฟล์ " + path)
        self.con = sqlite3.connect("file:%s?mode=ro" % path, uri=True)
        self.con.row_factory = sqlite3.Row
        self.jobs = job_names()

    def one(self, sql, *args):
        return self.con.execute(sql, args).fetchone()

    def all(self, sql, *args):
        return self.con.execute(sql, args).fetchall()

    def storage_zeny(self, account_id):
        row = self.one("SELECT StorageZeny FROM StorageInventory WHERE AccountId=?", account_id)
        return row["StorageZeny"] if row else 0

    def describe(self, row):
        stats = read_stats(row["Data"], row["DataLength"])
        job = stat(stats, JOB)
        return {
            "name": row["Name"],
            "id": row["Id"],
            "account": row["AccountId"],
            "slot": row["CharacterSlot"],
            "map": row["Map"],
            "level": stat(stats, LEVEL),
            "job_level": stat(stats, JOB_LEVEL),
            "job": self.jobs.get(job, "job %d" % job),
            "zeny": stat(stats, ZENY),
        }

    def characters_of(self, account_id):
        return [self.describe(r) for r in self.all("SELECT * FROM Character WHERE AccountId=? ORDER BY CharacterSlot", account_id)]


def show_character(db, row, with_parcels):
    c = db.describe(row)
    account = db.one("SELECT Id, UserName FROM DbUserAccount WHERE Id=?", c["account"])
    login = account["UserName"] if account else "(ไม่พบบัญชี)"
    storage = db.storage_zeny(c["account"])

    print("=" * 64)
    print("ตัวละคร   %s   (ช่อง %d, แมพ %s)" % (c["name"], c["slot"], c["map"]))
    print("เลเวล     Lv.%d  Job Lv.%d  %s" % (c["level"], c["job_level"], c["job"]))
    print("เงินในตัว %s" % money(c["zeny"]))
    print("เงินในคลัง %s   (คลังเป็นของทั้งบัญชี)" % money(storage))
    print("ไอดีที่ใช้  %s   (account id %d)" % (login, c["account"]))

    others = [x for x in db.characters_of(c["account"]) if x["id"] != c["id"]]
    if others:
        print("ตัวอื่นในบัญชีเดียวกัน:")
        for o in others:
            print("   %-24s Lv.%-3d %s   เงินในตัว %s" % (o["name"], o["level"], o["job"], money(o["zeny"])))

    addresses = db.all("SELECT Address, FirstSeen, LastSeen, LoginCount FROM AccountAddress WHERE AccountId=? ORDER BY FirstSeen", c["account"])
    print("ไอพีที่เคยเข้า (เก่าสุดคือประมาณวันที่เริ่มเล่น):")
    if not addresses:
        print("   (ไม่มีบันทึก)")
    for a in addresses:
        print("   %-18s ครั้งแรก %s   ล่าสุด %s   เข้า %d ครั้ง" % (a["Address"], a["FirstSeen"][:16], a["LastSeen"][:16], a["LoginCount"]))

    shared = db.all(
        "SELECT DISTINCT o.AccountId, o.AccountName, o.Address FROM AccountAddress o "
        "WHERE o.AccountId<>? AND o.Address IN (SELECT Address FROM AccountAddress WHERE AccountId=?) "
        "ORDER BY o.Address, o.AccountName", c["account"], c["account"])
    if shared:
        print("บัญชีอื่นที่เคยใช้ไอพีเดียวกัน (ไอพีเดียวกันไม่ได้แปลว่าโกง บ้านเดียวกัน/เน็ตมือถือก็ตรงกัน):")
        for s in shared:
            chars = db.characters_of(s["AccountId"])
            total = sum(x["zeny"] for x in chars) + db.storage_zeny(s["AccountId"])
            names = ", ".join(x["name"] for x in chars) or "-"
            print("   %-20s %-16s ตัวละคร: %s   เงินรวมทั้งบัญชี %s" % (s["AccountName"], s["Address"], names, money(total)))

    if with_parcels:
        parcels = db.all("SELECT FromName, Zeny, SentAt FROM InboxParcel WHERE CharacterId=? AND Zeny>0 ORDER BY SentAt", c["id"])
        print("พัสดุที่มีเงินส่งมาให้ (ยังไม่ได้รับ): %d รายการ" % len(parcels))
        for p in parcels:
            print("   จาก %-20s %s   %s" % (p["FromName"], money(p["Zeny"]), p["SentAt"][:16]))

    ban = db.one("SELECT Reason, ExpiresAt FROM Ban WHERE AccountId=? ORDER BY Id DESC", c["account"])
    if ban:
        print("เคยถูกแบน: %s (หมดอายุ %s)" % (ban["Reason"], ban["ExpiresAt"][:16]))


def show_top(db, count):
    rows = [db.describe(r) for r in db.all("SELECT * FROM Character")]
    if not rows:
        print("ฐานข้อมูลนี้ไม่มีตัวละคร")
        return

    login = {r["Id"]: r["UserName"] for r in db.all("SELECT Id, UserName FROM DbUserAccount")}
    storage = {r["AccountId"]: r["StorageZeny"] for r in db.all("SELECT AccountId, StorageZeny FROM StorageInventory")}
    rows.sort(key=lambda x: x["zeny"], reverse=True)

    ascending = sorted(x["zeny"] for x in rows)
    p90 = ascending[max(0, int(len(ascending) * 0.9) - 1)]
    print("เซิร์ฟมี %d ตัวละคร  ·  เงินในตัวรวม %s  ·  ค่ากลาง %s  ·  ตัวที่ 90%% %s" % (
        len(rows), money(sum(ascending)), money(int(statistics.median(ascending))), money(p90)))
    print()
    print("%-3s %-22s %-18s %-5s %-7s %16s %16s" % ("#", "ตัวละคร", "ไอดี", "Lv", "Job Lv", "เงินในตัว", "เงินในคลัง"))
    for i, x in enumerate(rows[:count], 1):
        print("%-3d %-22s %-18s %-5d %-7d %16s %16s" % (
            i, x["name"], login.get(x["account"], "?"), x["level"], x["job_level"], money(x["zeny"]), money(storage.get(x["account"], 0))))


def main():
    # Thai on a Windows console, and a closed pipe (| head) that is not an error.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]

    if "--top" in sys.argv:
        # --top takes its number as the next argument
        i = sys.argv.index("--top")
        count = int(sys.argv[i + 1]) if i + 1 < len(sys.argv) and sys.argv[i + 1].isdigit() else 15
        path = next(a for a in args if not a.isdigit())
        show_top(Db(path), count)
        return

    if len(args) < 2:
        print(__doc__)
        sys.exit(1)

    db = Db(args[0])
    name = " ".join(args[1:])
    rows = db.all("SELECT * FROM Character WHERE Name=?", name)
    if not rows:
        rows = db.all("SELECT * FROM Character WHERE Name LIKE ?", "%" + name + "%")
        if rows:
            print("ไม่มีชื่อ '%s' ตรงตัว เจอชื่อที่คล้ายกัน %d ตัว:" % (name, len(rows)))
    if not rows:
        sys.exit("ไม่พบตัวละครชื่อ '%s' (ดูว่าสะกดตรงและไม่มีเว้นวรรคแปลก ๆ)" % name)

    for row in rows:
        show_character(db, row, "--parcels" in flags)


if __name__ == "__main__":
    main()
