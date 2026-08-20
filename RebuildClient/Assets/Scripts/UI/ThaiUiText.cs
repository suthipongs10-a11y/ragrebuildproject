using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// Thai wording for the interface. Two ways in: Get, which the rebuilt windows use
    /// when they generate a label, and Apply, which walks a window the game built itself
    /// and swaps the wording it finds. Only whole strings are matched, so a label the
    /// table has never heard of is left exactly as it was.
    ///
    /// This covers the chrome: window names, buttons, slot names, tabs. Item, skill and
    /// monster names come from the server data files and stay as they are there.
    /// </summary>
    public static class ThaiUiText
    {
        private static readonly Dictionary<string, string> Words = new Dictionary<string, string>
        {
            //--- windows and the bar along the bottom
            { "Character", "ตัวละคร" },
            { "Stats", "สเตตัส" },
            { "Skills", "สกิล" },
            { "Skill", "สกิล" },
            { "Inventory", "กระเป๋า" },
            { "Equipment", "อุปกรณ์" },
            { "Hotbar", "แถบลัด" },
            { "Emotes", "อีโมชั่น" },
            { "Emote", "อีโมชั่น" },
            { "Config", "ตั้งค่า" },
            { "Options", "ตั้งค่า" },
            //the buttons along the bottom of the screen are a fixed width sized for the
            //English, and the longer Thai for help was being clipped mid word
            { "Help", "คู่มือ" },
            { "Database", "ฐานข้อมูล" },
            { "Market", "ตลาด" },
            { "Menu", "เมนู" },
            { "Cart", "รถเข็น" },
            { "Storage", "คลังเก็บของ" },
            { "Party", "ปาร์ตี้" },
            { "Nearby", "คนรอบตัว" },
            { "Guild", "กิลด์" },
            { "Chat", "แชท" },
            { "Room", "ห้อง" },

            //--- headers the rebuilt windows put under their titles
            { "Guide", "คำแนะนำ" },
            { "Character sheet", "ค่าสถานะตัวละคร" },
            { "Worn gear", "ของที่สวมใส่" },
            { "Drag to turn", "ลากเพื่อหมุนตัว" },
            { "System", "ระบบ" },
            { "New adventurer", "นักผจญภัยคนใหม่" },
            { "Skill tree", "สายสกิล" },

            //--- stats
            { "Points Available", "แต้มที่เหลือ" },
            { "Points remaining", "แต้มที่เหลือ" },
            { "Hold shift to add ten points at a time", "กด Shift ค้างไว้เพื่อเพิ่มทีละ 10 แต้ม" },
            { "Reset", "รีเซ็ต" },
            { "Apply", "ยืนยัน" },
            { "Atk", "พลังโจมตี" },
            { "Matk", "พลังเวท" },
            { "Hit", "ความแม่นยำ" },
            { "Critical", "คริติคอล" },
            { "Def", "ป้องกัน" },
            { "Mdef", "ป้องกันเวท" },
            { "Flee", "หลบหลีก" },
            { "Aspd", "ความเร็วโจมตี" },

            //--- equipment slots
            { "Upper Head", "ศีรษะบน" },
            { "Mid Head", "ศีรษะกลาง" },
            { "Lower Head", "ศีรษะล่าง" },
            { "Armor", "เสื้อเกราะ" },
            { "Right Hand", "มือขวา" },
            { "Left Hand", "มือซ้าย" },
            { "Garment", "ผ้าคลุม" },
            { "Footgear", "รองเท้า" },
            { "Accessory", "เครื่องประดับ" },
            { "Empty", "ว่าง" },
            { "Ammunition", "ลูกธนู / กระสุน" },
            {
                "Double-click a slot to unequip  ·  Right-click an item for details",
                "ดับเบิลคลิกเพื่อถอด  ·  ลากของจากกระเป๋ามาวางเพื่อสวมใส่"
            },

            //--- the escape menu
            { "Respawn", "เกิดใหม่" },
            { "Unstuck", "กลับจุดเซฟ" },
            { "Shortcut", "แถบลัด" },
            { "Logout", "ออกจากเกม" },
            { "Cancel", "ยกเลิก" },
            { "You Died", "ตัวละครตายแล้ว" },
            { "You Died Hint", "เลือก \"เกิดใหม่\" เพื่อกลับไปที่จุดเซฟ หรือ \"ออกจากเกม\"" },

            //--- character creation
            { "Create Character", "สร้างตัวละคร" },
            { "Create", "สร้าง" },
            { "Name", "ชื่อ" },
            { "Character name", "ชื่อตัวละคร" },
            { "Gender", "เพศ" },
            { "Male", "ชาย" },
            { "Female", "หญิง" },
            { "Hair style", "ทรงผม" },
            { "Hair color", "สีผม" },

            //--- inventory and skills
            { "Items", "ไอเทม" },
            { "Equip", "สวมใส่" },
            { "Etc", "อื่น ๆ" },
            { "Drop", "ทิ้ง" },
            { "Weight", "น้ำหนัก" },
            { "Zeny", "เซนี่" },
            { "Lock Points", "ล็อกแต้ม" },
            { "Novice", "มือใหม่" },
            { "1st Job", "อาชีพ 1" },
            { "2nd Job", "อาชีพ 2" },
            { "Other", "อื่น ๆ" },

            //--- options
            { "Game", "เกม" },
            { "UI", "หน้าจอ" },
            { "Experimental", "ทดลอง" },
            { "Audio Volume", "ระดับเสียง" },
            { "Master", "เสียงรวม" },
            { "BGM", "เพลง" },
            { "Environment", "เสียงรอบข้าง" },
            { "Effects", "เอฟเฟกต์" },
            { "Mute", "ปิดเสียง" },
            { "Display", "การแสดงผล" },
            { "Text", "ข้อความ" },
            { "Close", "ปิด" },
            { "OK", "ตกลง" },
            { "Yes", "ใช่" },
            { "No", "ไม่" },

            //--- the database window
            { "Monsters", "มอนสเตอร์" },
            { "Monster", "มอนสเตอร์" },
            { "Maps", "แผนที่" },
            { "Map", "แผนที่" },
            //NPC is left in English: it is a term the game itself uses everywhere, and
            //spelling it out phonetically in Thai reads worse than the abbreviation
            { "Back", "ย้อนกลับ" },
            { "Search", "ค้นหา" },
            { "Drops", "ของที่ดรอป" },
            { "Dropped By", "ดรอปจาก" },
            { "Sold By", "ขายโดย" },
            { "Sells", "ขาย" },
            { "Spawns", "จุดเกิด" },
            { "Connections", "ทางเชื่อม" },
            { "Element", "ธาตุ" },
            { "Race", "เผ่าพันธุ์" },
            { "Size", "ขนาด" },
            { "Level", "เลเวล" },
            { "Exp", "ค่าประสบการณ์" },
            { "Description", "คำอธิบาย" },
            { "Type", "ประเภท" },
            { "Range", "ระยะ" },
            { "Price", "ราคา" },
            { "Slots", "ช่องการ์ด" },

            //--- logging in and picking a character
            { "Login", "เข้าสู่ระบบ" },
            { "Log In", "เข้าสู่ระบบ" },
            { "Register", "สมัครสมาชิก" },
            { "Create New", "สมัครใหม่" },
            { "Server Settings", "ตั้งค่าเซิร์ฟเวอร์" },
            { "Remember password", "จำรหัสผ่าน" },
            { "Remember Password", "จำรหัสผ่าน" },
            { "Server", "เซิร์ฟเวอร์" },
            { "Username", "ชื่อผู้ใช้" },
            { "Password", "รหัสผ่าน" },
            { "Repeat Password", "ยืนยันรหัสผ่าน" },
            { "Remember Me", "จดจำการเข้าสู่ระบบ" },
            { "Submit", "ตกลง" },
            { "Delete", "ลบ" },
            { "Select Character", "เลือกตัวละคร" },
            { "Job", "อาชีพ" },
            { "Location", "ตำแหน่ง" },
            { "HP", "พลังชีวิต" },
            { "SP", "พลังเวท" },
            { "Empty Slot", "ช่องว่าง" },
            { "Appearance Data Unavailable", "ไม่พบข้อมูลรูปลักษณ์" },

            //--- talking to an NPC, shopping and storage
            { "Buy", "ซื้อ" },
            { "Sell", "ขาย" },
            { "Deposit", "ฝาก" },
            { "Withdraw", "ถอน" },
            { "Total", "รวม" },
            { "Amount", "จำนวน" },
            { "Confirm", "ยืนยัน" },
            { "Next", "ถัดไป" },
            { "Trade", "แลกเปลี่ยน" },
            { "Shop", "ร้านค้า" },
            { "Refine", "ตีบวก" },
            { "Save", "บันทึก" },
        };

        /// <summary>
        /// The Thai for a label the code is about to create, or the label itself when
        /// the table has nothing for it.
        /// </summary>
        public static string Get(string english)
        {
            if (string.IsNullOrEmpty(english))
                return english;

            return Words.TryGetValue(english, out var thai) ? thai : english;
        }

        /// <summary>
        /// Swaps the wording on every label under the root that the table recognises.
        /// Safe to call more than once: Thai is never a key, so a translated label is
        /// simply not matched a second time.
        /// </summary>
        public static void Apply(Transform root)
        {
            Apply(root, false);
        }

        /// <summary>
        /// The same, restricted to labels that sit inside a button or a toggle. The bar
        /// along the bottom of the screen is swept on a timer, and that sweep also
        /// passes over the chat log: a player typing the word Skills into chat should
        /// not have it rewritten underneath them.
        /// </summary>
        public static void ApplyToControls(Transform root)
        {
            Apply(root, true);
        }

        private static void Apply(Transform root, bool controlsOnly)
        {
            if (root == null)
                return;

            foreach (var text in root.GetComponentsInChildren<TextMeshProUGUI>(true))
            {
                var current = text.text;
                if (string.IsNullOrEmpty(current))
                    continue;

                if (controlsOnly && text.GetComponentInParent<Selectable>(true) == null)
                    continue;

                if (Words.TryGetValue(current.Trim(), out var thai))
                    text.text = thai;
            }
        }
    }
}
