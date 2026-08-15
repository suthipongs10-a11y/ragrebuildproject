using System.Collections.Generic;

namespace Assets.Scripts.UI.Guide
{
    /// <summary>
    /// One way of playing a job: what it is for, where the points go, which skills in
    /// which order, and what to wear at three levels of wealth.
    /// </summary>
    public class GuideBuild
    {
        public string Name;
        public string Suits;
        public string Stats;
        public string Skills;
        public string GearEarly;
        public string GearMid;
        public string GearLate;
        public string Cards;
    }

    public class JobGuide
    {
        public string Job;
        public string Intro;
        public GuideBuild[] Builds;
    }

    /// <summary>
    /// Advice for every job this server actually has a skill tree for.
    ///
    /// Written against the server's own files rather than from what the same job does in
    /// other Ragnarok servers, because on this one they differ. Every skill named here is
    /// in Skills/SkillTree.toml and can be learned; every card named here has an effect
    /// written for it in Script/Items/CardEffects.txt and the numbers quoted are the ones
    /// in that file; every piece of gear named here is a row in the item tables. A card
    /// with an empty effect block, of which there are a few, is not recommended at all,
    /// because wearing it would do nothing.
    ///
    /// The tree covers thirteen jobs. The rest — Crusader, Monk, Sage, Rogue, Bard,
    /// Dancer, Alchemist and the later ones — have no entry in it, so they have no skills
    /// to spend points on yet and get the standing note instead of invented advice.
    /// </summary>
    public static class JobGuideData
    {
        public const string NoTreeNote =
            "อาชีพนี้ยังไม่มีสายสกิลในเซิร์ฟเวอร์ (ไฟล์ SkillTree.toml ยังไม่มีข้อมูลของอาชีพนี้) "
            + "เปลี่ยนไปแล้วจะยังกดสกิลอะไรไม่ได้ นอกจากสกิลของอาชีพแรกที่ติดตัวมา\n\n"
            + "ถ้าอยากเล่นตอนนี้ แนะนำอาชีพที่ทำเสร็จแล้ว: Knight, Wizard, Priest, Hunter, "
            + "Assassin, Blacksmith";

        public const string GeneralNote =
            "ของสามระดับในหน้านี้หมายถึง\n"
            + "<b>ระดับ 1</b> ของหาง่าย ซื้อจาก NPC หรือมอนดรอปบ่อย ใส่ได้ตั้งแต่เริ่ม\n"
            + "<b>ระดับ 2</b> เริ่มมีเงินแล้ว ของแพงขึ้นแต่ยังหาซื้อได้ ตีบวก +4 ถึง +7\n"
            + "<b>ระดับ 3</b> ของหายาก ดรอปจากบอส ของ +10 และการ์ด MVP";

        private static readonly Dictionary<int, JobGuide> Guides = new Dictionary<int, JobGuide>
        {
            //--- Novice -------------------------------------------------------------
            [0] = new JobGuide
            {
                Job = "Novice — มือใหม่",
                Intro = "ยังไม่ต้องคิดมาก เก็บ Job Level ให้ถึง 10 แล้วไปเปลี่ยนอาชีพ "
                        + "แต้มสเตตัสที่ลงตอนนี้จะติดตัวไปด้วย เพราะฉะนั้นอย่าลงมั่ว",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "ไต่ไปเปลี่ยนอาชีพ",
                        Suits = "ทุกแนวทาง",
                        Stats = "ลงเท่าที่จำเป็นเพื่อให้ตีมอนไหว แล้วเก็บที่เหลือไว้\n"
                                + "• STR 9 พอถือของและตีเข้า\n"
                                + "• DEX 9 กันตีพลาด\n"
                                + "• ที่เหลือรอไว้ลงหลังเปลี่ยนอาชีพ จะได้ไม่ลงผิดสาย",
                        Skills = "Basic Mastery 9 → First Aid 1\n"
                                 + "สายนี้ไม่มีอะไรให้เลือก Basic Mastery คือสกิลที่เปิดร้านค้า "
                                 + "การนั่ง และการแลกของ ต้องกดให้ครบอยู่แล้ว",
                        GearEarly = "Knife, Club, Cotton Shirt, Sandals — ซื้อได้ที่ NPC ในเมือง",
                        GearMid = "Adventurer's Suit, Shoes, Hood, Guard",
                        GearLate = "ยังไม่ต้องซื้อของแพง เก็บเงินไว้ซื้อของหลังเปลี่ยนอาชีพคุ้มกว่ามาก",
                        Cards = "Pupa Card ใส่เสื้อ (HP +700) — ใบเดียวเปลี่ยนชีวิตช่วงเลเวลต่ำ\n"
                                + "Poring Card ใส่เสื้อ (LUK +2, Perfect Dodge +10) ถ้าหาใบบนไม่ได้",
                    },
                },
            },

            //--- Swordsman ----------------------------------------------------------
            [1] = new JobGuide
            {
                Job = "Swordsman — ทหารดาบ",
                Intro = "เลือดหนา ตีแรง เดินเข้าไปตีตรง ๆ ได้โดยไม่ต้องคิดมาก "
                        + "เป็นอาชีพแรกที่ไต่เลเวลง่ายที่สุดในเซิร์ฟเวอร์นี้",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "ไต่เลเวลด้วย Bash",
                        Suits = "ลุยเดี่ยว",
                        Stats = "STR ▸ AGI ▸ VIT ▸ DEX\n"
                                + "• STR ทุกแต้มที่เหลือ ยิ่งเยอะยิ่งดี\n"
                                + "• AGI 40-60 หลบได้และตีถี่ขึ้น\n"
                                + "• VIT 20-30 พอไม่ตายง่าย\n"
                                + "• DEX 20 พอตีไม่พลาด",
                        Skills = "Bash 10 → Sword Mastery 10 → Magnum Break 3 → Provoke 5 → Endure 1\n"
                                 + "Bash คือทั้งหมดของช่วงนี้ ทุ่มก่อนเป็นอันดับแรก\n"
                                 + "Magnum Break ไว้เก็บมอนที่รุมเข้ามา ไม่ต้องกดเต็ม\n"
                                 + "<b>ถ้าจะไป Knight</b> ต้องมี Two-Hand Sword Mastery 5, Bash 10 "
                                 + "และ Counter Attack 5 ก่อน ถึงจะกด Bowling Bash ได้",
                        GearEarly = "Sword หรือ Falchion, Cotton Shirt, Sandals, Hood, Guard",
                        GearMid = "Blade, Adventurer's Suit, Shoes, Muffler, Buckler, Clip",
                        GearLate = "Two-Handed Sword หรือ Tsurugi +7, Chain Mail, Boots, Manteau, Buckler",
                        Cards = "อาวุธ: Andre Card (ATK +20) หรือ Hydra Card (+20% ใส่คน — ใช้กับมอนตระกูล Demihuman ได้ด้วย)\n"
                                + "เสื้อ: Pupa Card (HP +700)\n"
                                + "รองเท้า: Matyr Card (HP +10%, AGI +1)\n"
                                + "ผ้าคลุม: Raydric Card (ลดดาเมจธาตุไร้ธาตุ 20%) — ใบนี้ดีทุกอาชีพที่เดินเข้าไปตี",
                    },
                },
            },

            //--- Archer -------------------------------------------------------------
            [2] = new JobGuide
            {
                Job = "Archer — นักธนู",
                Intro = "ตีไกล ไม่ต้องเข้าไปโดน ถ้าเล่นให้ดีคือยิงตายก่อนมอนเดินมาถึง "
                        + "จุดอ่อนคือเลือดน้อย โดนตีสองทีก็หนัก",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "ยิงเดี่ยว (Double Strafe)",
                        Suits = "ลุยเดี่ยว",
                        Stats = "DEX ▸ AGI ▸ VIT\n"
                                + "• DEX ทุกแต้ม ยิงแรงและแม่นขึ้นพร้อมกัน\n"
                                + "• AGI 40-60 ตีถี่ขึ้น\n"
                                + "• VIT 20 พอกันตายทีเดียว",
                        Skills = "Double Strafe 10 → Owl's Eye 10 → Vulture's Eye 10 → "
                                 + "Improve Concentration 10 → Arrow Shower 5\n"
                                 + "Double Strafe ก่อนเสมอ เป็นสกิลที่ใช้ทั้งเกม\n"
                                 + "Vulture's Eye เพิ่มระยะยิง แปลว่ายิงได้ก่อนมอนขยับ",
                        GearEarly = "Bow, Cotton Shirt, Sandals, Hood\n"
                                    + "ลูกธนูสำคัญกว่าที่คิด: พกลูกธนูธาตุติดตัวไว้หลายแบบ",
                        GearMid = "Composite Bow, Adventurer's Suit, Shoes, Muffler, Clip, Cap",
                        GearLate = "Cross Bow หรือ Gakkung Bow +7, Silver Robe, Boots, Manteau, "
                                   + "Apple of Archer (DEX)",
                        Cards = "อาวุธ: Archer Skeleton Card (ดาเมจระยะไกล +10%) หรือ Andre Card (ATK +20)\n"
                                + "เครื่องประดับ: Zerom Card (DEX +3) สองใบเลยยิ่งดี\n"
                                + "รองเท้า: Matyr Card (HP +10%)\n"
                                + "ผ้าคลุม: Whisper Card (Flee +20 แต่แพ้ธาตุผี 50%) หรือ Raydric Card ถ้าเน้นปลอดภัย",
                    },
                },
            },

            //--- Mage ---------------------------------------------------------------
            [3] = new JobGuide
            {
                Job = "Mage — นักเวท",
                Intro = "ดาเมจสูงสุดต่อหนึ่งครั้งในเกมช่วงต้น แลกกับเลือดบางที่สุด "
                        + "และต้องยืนร่ายไม่ให้โดนขัด",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "สายบอลต์ (ยิงทีละตัว)",
                        Suits = "ลุยเดี่ยว, ล่าบอส",
                        Stats = "INT ▸ DEX ▸ VIT\n"
                                + "• INT ทุกแต้ม คือดาเมจตรง ๆ\n"
                                + "• DEX 40-60 ร่ายไวขึ้น สำคัญพอ ๆ กับ INT\n"
                                + "• VIT 20 พอไม่ตายทันที",
                        Skills = "Fire Bolt 10 → Cold Bolt 10 → Lightning Bolt 10 → "
                                 + "Napalm Beat 4 → Soul Strike 10\n"
                                 + "เก็บบอลต์ให้ครบสามธาตุ แล้วเลือกใช้ตามธาตุมอน "
                                 + "อันนี้แหละคือความแรงของ Mage\n"
                                 + "Soul Strike ยิงผีได้ทุกตัวโดยไม่ต้องดูธาตุ",
                        GearEarly = "Rod, Cotton Shirt, Sandals",
                        GearMid = "Wand หรือ Staff, Silk Robe, Shoes, Muffler, Clip",
                        GearLate = "Arc Wand +7, Silver Robe, Boots, Manteau, Circlet",
                        Cards = "เครื่องประดับ: Phen Card (ร่ายไม่ถูกขัด แลกเวลาร่าย +10%) — "
                                + "ใบนี้เปลี่ยนวิธีเล่นทั้งหมด ยืนร่ายกลางวงได้\n"
                                + "เครื่องประดับ: Zerom Card (DEX +3) ร่ายไวขึ้น\n"
                                + "หมวก/เสื้อ: Elder Willow Card (INT +2)\n"
                                + "รองเท้า: Sohee Card (SP สูงสุด +15%, ฟื้น SP +3%)",
                    },
                    new GuideBuild
                    {
                        Name = "สายเก็บฝูง (Fire Wall / Thunder Storm)",
                        Suits = "ปาร์ตี้, ไต่เลเวลเร็ว",
                        Stats = "INT ▸ DEX ▸ VIT — เหมือนสายบอลต์ แต่ DEX สำคัญกว่า เพราะสกิลร่ายนาน\n"
                                + "DEX 60+ ถ้าจะยืนกลางสนาม",
                        Skills = "Fire Bolt 4 → Fire Ball 5 → Sight 1 → Fire Wall 10 → "
                                 + "Lightning Bolt 4 → Thunder Storm 10 → Safety Wall\n"
                                 + "Fire Wall คือกำแพงกันมอน ใช้กันตัวเองและกันปาร์ตี้ ไม่ใช่แค่ทำดาเมจ\n"
                                 + "Safety Wall ต้องมี Napalm Beat 7 กับ Soul Strike 5 ก่อน "
                                 + "แต่คุ้มมากถ้าจะยืนหน้าปาร์ตี้",
                        GearEarly = "Rod, Cotton Shirt, Sandals",
                        GearMid = "Staff, Silk Robe, Shoes, Muffler, Clip",
                        GearLate = "Arc Wand +7, Silver Robe, Boots, Manteau",
                        Cards = "เครื่องประดับ: Phen Card (ร่ายไม่ถูกขัด) — สายนี้แทบบังคับ\n"
                                + "รองเท้า: Sohee Card (SP +15%) เพราะสกิลกินเปลือง\n"
                                + "เสื้อ: Pupa Card (HP +700) เอาไว้รอดตอนโดนรุม",
                    },
                },
            },

            //--- Acolyte ------------------------------------------------------------
            [4] = new JobGuide
            {
                Job = "Acolyte — บาทหลวง",
                Intro = "ตีไม่แรง แต่เป็นอาชีพที่ปาร์ตี้อยากได้ที่สุด และวาร์ปได้ตั้งแต่ยังไม่เปลี่ยนอาชีพ",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "ซัพพอร์ท (ไปทาง Priest)",
                        Suits = "ปาร์ตี้, ซัพพอร์ท",
                        Stats = "INT ▸ DEX ▸ VIT\n"
                                + "• INT ยิ่งสูง Heal ยิ่งแรงและ SP ยิ่งเยอะ\n"
                                + "• DEX 40+ ร่ายไว ตอนคนกำลังจะตายมันต่างกันมาก\n"
                                + "• VIT 30 เพราะซัพพอร์ทที่ตายคือซัพพอร์ทที่ช่วยใครไม่ได้",
                        Skills = "Heal 10 → Divine Protection 5 → Blessing 10 → Increase Agility 10 → "
                                 + "Ruwach 1 → Teleport 2 → Warp Portal 4 → Pneuma\n"
                                 + "Blessing กับ Increase Agility คือเหตุผลที่ปาร์ตี้ชวนคุณ ทุ่มก่อน\n"
                                 + "Teleport 2 ใช้กลับเมืองได้ ประหยัดผ้ายันต์ทั้งเกม",
                        GearEarly = "Club, Cotton Shirt, Sandals, Rosary",
                        GearMid = "Mace, Silk Robe, Shoes, Muffler, Clip, Biretta",
                        GearLate = "Golden Mace +7, Saint's Robe, Boots, Manteau, Rosary สองวง",
                        Cards = "เครื่องประดับ: Phen Card (ร่ายไม่ถูกขัด) — Heal ที่ถูกขัดคือคนตาย\n"
                                + "เครื่องประดับ: Zerom Card (DEX +3)\n"
                                + "รองเท้า: Sohee Card (SP สูงสุด +15%) หรือ Eggyra Card (ฟื้น SP +15%)\n"
                                + "เสื้อ: Marc Card (กันแช่แข็ง 100%) — โดนแช่แข็งทีเดียวปาร์ตี้ล่ม",
                    },
                    new GuideBuild
                    {
                        Name = "สายตีผี (ไปทาง Priest สายตี)",
                        Suits = "ลุยเดี่ยว",
                        Stats = "INT ▸ DEX ▸ STR\n"
                                + "• INT เป็นหลัก เพราะดาเมจสายนี้คิดจาก INT\n"
                                + "• DEX 40+ ร่ายไว\n"
                                + "• STR พอถือของ",
                        Skills = "Heal 10 → Divine Protection 3 → Demon Bane 10 → Holy Light 1 → "
                                 + "Signum Crusis 3 → Angelus 5\n"
                                 + "Heal ใช้ตีผีได้โดยตรง อย่ามองว่าเป็นสกิลรักษาอย่างเดียว\n"
                                 + "Demon Bane เพิ่มดาเมจใส่ปีศาจและอันเดด ซึ่งคือมอนส่วนใหญ่ที่จะไปตี",
                        GearEarly = "Club, Cotton Shirt, Sandals",
                        GearMid = "Mace, Silk Robe, Shoes, Muffler, Clip",
                        GearLate = "Golden Mace +7, Saint's Robe, Boots, Manteau",
                        Cards = "อาวุธ: Andre Card (ATK +20)\n"
                                + "เสื้อ: Pupa Card (HP +700)\n"
                                + "เครื่องประดับ: Zerom Card (DEX +3)\n"
                                + "โล่: Thara Frog Card (ลดดาเมจจากคน 30%)",
                    },
                },
            },

            //--- Thief --------------------------------------------------------------
            [5] = new JobGuide
            {
                Job = "Thief — โจร",
                Intro = "หลบเก่งที่สุดในเกม ถ้า Flee พอ มอนจะตีไม่โดนเลยแม้แต่ครั้งเดียว "
                        + "และขโมยของจากมอนได้ด้วย",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "หลบและตีถี่",
                        Suits = "ลุยเดี่ยว",
                        Stats = "AGI ▸ STR ▸ DEX\n"
                                + "• AGI ทุกแต้มจนถึง 90+ นี่คือทั้งเกราะและความเร็วโจมตี\n"
                                + "• STR ตามมาเป็นอันดับสอง\n"
                                + "• DEX 20-30 พอไม่ตีพลาด",
                        Skills = "Double Attack 10 → Improve Dodge 10 → Steal 10 → Envenom 1-5 → "
                                 + "Hiding 1 → Back Slide 1\n"
                                 + "Double Attack คือดาเมจทั้งหมดของสายนี้ ทุ่มก่อน\n"
                                 + "Steal คุ้มมากในเซิร์ฟเวอร์นี้ ขโมยของที่ปกติดรอปยากได้\n"
                                 + "Hiding ใช้หนีตาย เอาไว้ 1 แต้มก็พอ",
                        GearEarly = "Knife หรือ Main Gauche, Cotton Shirt, Sandals, Hood",
                        GearMid = "Gladius หรือ Stiletto, Adventurer's Suit, Shoes, Muffler, Clip",
                        GearLate = "Damascus +7, Chain Mail, Boots, Manteau, Ring",
                        Cards = "อาวุธ: Andre Card (ATK +20) หรือ Skeleton Card (ATK +10 + มีโอกาสทำสตัน)\n"
                                + "เครื่องประดับ: Kukre Card (AGI +2) หรือ Male Thief Bug Card (AGI +2)\n"
                                + "ผ้าคลุม: Whisper Card (Flee +20) — สายนี้ยิ่ง Flee ยิ่งอมตะ\n"
                                + "รองเท้า: Matyr Card (HP +10%, AGI +1)",
                    },
                },
            },

            //--- Merchant -----------------------------------------------------------
            [6] = new JobGuide
            {
                Job = "Merchant — พ่อค้า",
                Intro = "ซื้อถูกขายแพง แบกของได้เยอะที่สุด และตีแรงด้วยเงินตัวเอง "
                        + "ถ้าชอบสะสมของ อาชีพนี้คือฐานของทุกอย่าง",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "ตีด้วยเงิน (Mammonite)",
                        Suits = "ลุยเดี่ยว, หาเงิน",
                        Stats = "STR ▸ DEX ▸ VIT\n"
                                + "• STR ทุกแต้ม\n"
                                + "• DEX 30-40 ตีไม่พลาด\n"
                                + "• VIT 30 เพราะต้องยืนตี",
                        Skills = "Enlarge Weight Limit 10 → Discount 10 → Overcharge 10 → "
                                 + "Mammonite 10 → Push Cart 10 → Vending 1 → Item Appraisal 1\n"
                                 + "Discount กับ Overcharge จ่ายคืนตัวเองเร็วมาก กดก่อนเสมอ\n"
                                 + "Mammonite เปลืองเงินแต่แรงจริง ใช้เฉพาะตัวที่ต้องรีบเก็บ\n"
                                 + "Push Cart 10 ต่อด้วย Cart Revolution ถ้าจะไป Blacksmith",
                        GearEarly = "Axe, Cotton Shirt, Sandals, Hood",
                        GearMid = "Battle Axe หรือ Orcish Axe, Adventurer's Suit, Shoes, Muffler, Clip",
                        GearLate = "Two-Handed Axe +7 หรือ Buster, Chain Mail, Boots, Manteau",
                        Cards = "อาวุธ: Andre Card (ATK +20) หรือ Minorous Card (+15% ใส่ตัวใหญ่ +ATK 5)\n"
                                + "เสื้อ: Pupa Card (HP +700)\n"
                                + "รองเท้า: Verit Card (HP และ SP +8%)\n"
                                + "ผ้าคลุม: Raydric Card (ลดธาตุไร้ธาตุ 20%)",
                    },
                },
            },

            //--- Knight -------------------------------------------------------------
            [7] = new JobGuide
            {
                Job = "Knight — อัศวิน",
                Intro = "อาชีพที่ครบที่สุดในเซิร์ฟเวอร์นี้ ทั้งดาบสองมือ หอก และขี่ Peco "
                        + "ทำได้จริงทุกสาย เลือกจากว่าจะเล่นคนเดียวหรือเล่นกับเพื่อน",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "ดาบสองมือ (Two-Hand Quicken)",
                        Suits = "ลุยเดี่ยว",
                        Stats = "STR ▸ AGI ▸ VIT ▸ DEX\n"
                                + "• STR 90+ ทุ่มเป็นอันดับแรก\n"
                                + "• AGI 80+ คู่กับ Two-Hand Quicken แล้วตีถี่มาก\n"
                                + "• VIT 30-40\n"
                                + "• DEX 30 พอไม่พลาด",
                        Skills = "Two-Hand Sword Mastery 10 → Two-Hand Quicken 10 → Bash 10 → "
                                 + "Counter Attack 5 → Endure 3 → Provoke 5\n"
                                 + "Two-Hand Quicken คือหัวใจ กดค้างไว้แล้วเดินตีอย่างเดียว\n"
                                 + "Counter Attack เอาไว้ตอนโดนรุม สวนกลับแรงมาก",
                        GearEarly = "Katana หรือ Bastard Sword, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Two-Handed Sword, Chain Mail, Boots, Manteau, Clip, Helm",
                        GearLate = "Claymore หรือ Zweihander +10, Full Plate, Greaves, Manteau, "
                                   + "Magni's Cap",
                        Cards = "อาวุธ: Hydra Card (+20% ใส่คน) กับ Skel Worker Card (+15% ตัวกลาง) — "
                                + "อาวุธหลายรูใส่ผสมกันได้\n"
                                + "เสื้อ: Pupa Card (HP +700) หรือ Peco Peco Card (HP สูงสุด +10%)\n"
                                + "รองเท้า: Matyr Card (HP +10%, AGI +1)\n"
                                + "ผ้าคลุม: Raydric Card (ลดธาตุไร้ธาตุ 20%)\n"
                                + "<b>ระดับ 3</b> Doppelganger Card ในอาวุธ (ASPD +10%) หรือ "
                                + "Turtle General Card (ดาเมจ +20% ทั้งมอนธรรมดาและบอส)",
                    },
                    new GuideBuild
                    {
                        Name = "บลาดหอก (Bowling Bash)",
                        Suits = "ปาร์ตี้, เก็บมอนเป็นฝูง",
                        Stats = "STR ▸ DEX ▸ VIT ▸ AGI\n"
                                + "• STR 90+\n"
                                + "• DEX 40-60 เพราะ Bowling Bash พลาดไม่ได้\n"
                                + "• VIT 50+ สายนี้ยืนกลางวง ต้องอึด\n"
                                + "• AGI ทีหลัง",
                        Skills = "Bash 10 → Two-Hand Sword Mastery 5 → Counter Attack 5 → "
                                 + "Two-Hand Quicken 10 → Bowling Bash 10\n"
                                 + "<b>เงื่อนไขจริงในเซิร์ฟเวอร์นี้:</b> Bowling Bash ต้องมี "
                                 + "Two-Hand Sword Mastery 5, Bash 10, Counter Attack 5 และ "
                                 + "Two-Hand Quicken 10 ครบก่อน ไม่มีทางลัด\n"
                                 + "แปลว่าสายนี้กว่าจะได้ของจริงต้อง Job สูงพอสมควร อดทนหน่อย",
                        GearEarly = "Bastard Sword, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Two-Handed Sword, Chain Mail, Boots, Manteau, Helm",
                        GearLate = "Claymore +10, Full Plate, Greaves, Manteau",
                        Cards = "อาวุธ: Hydra Card ผสม Minorous Card (+15% ตัวใหญ่)\n"
                                + "เสื้อ: Peco Peco Card (HP สูงสุด +10%)\n"
                                + "โล่: Thara Frog Card (ลดดาเมจจากคน 30%)\n"
                                + "ผ้าคลุม: Raydric Card\n"
                                + "<b>ระดับ 3</b> Tao Gunka Card (HP +100% แลก DEF/MDEF -50) — "
                                + "แรงมากแต่เสี่ยง ใส่ตอนมีคนฮีลให้เท่านั้น",
                    },
                    new GuideBuild
                    {
                        Name = "หอกบนหลัง Peco",
                        Suits = "ลุยเดี่ยว, ล่าบอส",
                        Stats = "STR ▸ DEX ▸ VIT\n"
                                + "• STR 90+\n"
                                + "• DEX 40+ เพราะสกิลหอกเป็นสกิลที่ต้องเข้า\n"
                                + "• VIT 40+",
                        Skills = "Spear Mastery 10 → Pierce 10 → Spear Stab 5 → "
                                 + "Peco Peco Riding 1 → Cavalier Mastery 5 → Brandish Spear 10\n"
                                 + "Pierce แรงใส่ตัวใหญ่มาก ซึ่งคือบอสเกือบทุกตัว\n"
                                 + "ขี่ Peco แล้วเดินเร็วขึ้นและดาเมจหอกดีขึ้น แต่เข้าในร่มไม่ได้\n"
                                 + "Spear Boomerang เอาไว้ดึงมอนเข้ามาทีละตัว",
                        GearEarly = "Javelin หรือ Spear, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Pike, Chain Mail, Boots, Manteau, Helm",
                        GearLate = "Lance หรือ Hunting Spear +10, Full Plate, Greaves, Manteau",
                        Cards = "อาวุธ: Minorous Card (+15% ตัวใหญ่) — เข้าทางสายหอกที่สุด\n"
                                + "อาวุธ: Hydra Card ถ้าไปตีมอนตระกูลคน\n"
                                + "เสื้อ: Pupa Card หรือ Peco Peco Card\n"
                                + "ผ้าคลุม: Raydric Card\n"
                                + "<b>ระดับ 3</b> Orc Hero Card ในหมวก (กันสตัน 100%, VIT +3) — "
                                + "ล่าบอสแล้วโดนสตันคือตาย ใบนี้แก้ปัญหานั้นทั้งใบ",
                    },
                },
            },

            //--- Wizard -------------------------------------------------------------
            [8] = new JobGuide
            {
                Job = "Wizard — พ่อมด",
                Intro = "ดาเมจสูงสุดในเกม และเป็นอาชีพเดียวที่เก็บมอนทั้งจอได้ในครั้งเดียว "
                        + "แลกกับเลือดบางและต้องยืนร่ายนาน",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "เก็บฝูง (Storm Gust / Meteor Storm)",
                        Suits = "ปาร์ตี้, ไต่เลเวลเร็ว",
                        Stats = "INT ▸ DEX ▸ VIT\n"
                                + "• INT 90+ ทุ่มก่อน\n"
                                + "• DEX 60-80 สกิลพวกนี้ร่ายนานมาก DEX คือสิ่งที่ทำให้ใช้ได้จริง\n"
                                + "• VIT 30-40 พอไม่โดนตีทีเดียวตาย",
                        Skills = "Lightning Bolt 5 → Napalm Beat 1 → Jupitel Thunder 5 → "
                                 + "Frost Diver 1 → Storm Gust 10 → Thunder Storm 1 → "
                                 + "Lord of Vermilion 10 → Sightrasher 2 → Meteor Storm 10\n"
                                 + "Storm Gust ก่อนเสมอ แช่แข็งมอนทั้งวงแล้วค่อย ๆ เก็บ\n"
                                 + "Lord of Vermilion กับ Meteor Storm ไว้กับมอนที่ไม่กลัวน้ำแข็ง\n"
                                 + "Quagmire ทำให้มอนเดินช้า ใช้คู่กับสกิลร่ายนานได้ดีมาก",
                        GearEarly = "Rod, Silk Robe, Shoes, Muffler",
                        GearMid = "Arc Wand, Silver Robe, Boots, Manteau, Clip, Circlet",
                        GearLate = "Wizardry Staff หรือ Arc Wand +10, Mink Coat, Boots, Manteau",
                        Cards = "เครื่องประดับ: Phen Card (ร่ายไม่ถูกขัด) — สายนี้ขาดไม่ได้จริง ๆ\n"
                                + "เครื่องประดับ: Zerom Card (DEX +3) อีกวง\n"
                                + "รองเท้า: Sohee Card (SP สูงสุด +15%)\n"
                                + "เสื้อ: Marc Card (กันแช่แข็ง 100%) — Storm Gust ของตัวเองไม่แช่ตัวเอง "
                                + "แต่ Wizard ฝั่งตรงข้ามและมอนน้ำแข็งแช่ได้\n"
                                + "<b>ระดับ 3</b> Pharaoh Card ในหมวก (SP ที่ใช้ -30%) — "
                                + "แปลว่าร่ายได้มากกว่าเดิมเกือบครึ่ง",
                    },
                    new GuideBuild
                    {
                        Name = "ยิงเดี่ยว / ล่าบอส",
                        Suits = "ล่าบอส, ลุยเดี่ยว",
                        Stats = "INT ▸ DEX ▸ VIT — เหมือนสายบน แต่ DEX สำคัญกว่าอีก เพราะบอสเดินเข้าหา\n"
                                + "DEX 80+ ถ้าเป็นไปได้",
                        Skills = "Cold Bolt 10 → Fire Bolt 10 → Lightning Bolt 10 → "
                                 + "Jupitel Thunder 10 → Water Ball 5 → Frost Diver 5\n"
                                 + "Jupitel Thunder ดันบอสถอยหลังด้วย ซื้อเวลาให้ตัวเองได้\n"
                                 + "Water Ball แรงมากถ้ายืนในน้ำ ใช้คู่กับ Frost Diver หรือพื้นน้ำ\n"
                                 + "Ice Wall กั้นทางบอสได้ ใบ้ไว้เท่านี้ ลองเล่นแล้วจะรู้ว่าโกงแค่ไหน",
                        GearEarly = "Rod, Silk Robe, Shoes, Muffler",
                        GearMid = "Arc Wand, Silver Robe, Boots, Manteau, Clip",
                        GearLate = "Wizardry Staff, Mink Coat, Boots, Manteau",
                        Cards = "เครื่องประดับ: Phen Card + Zerom Card\n"
                                + "รองเท้า: Sohee Card (SP +15%)\n"
                                + "โล่: Alice Card (ลดดาเมจจากบอส 40% แลกโดนมอนธรรมดาแรงขึ้น 40%) — "
                                + "ใบนี้ทำมาเพื่อสายล่าบอสโดยเฉพาะ ถอดออกเวลาไต่เลเวลปกติ\n"
                                + "<b>ระดับ 3</b> Golden Thief Bug Card ในโล่ (ภูมิคุ้มกันเวท แลก SP ที่ใช้ +100%)",
                    },
                },
            },

            //--- Priest -------------------------------------------------------------
            [9] = new JobGuide
            {
                Job = "Priest — นักบวช",
                Intro = "อาชีพที่ปาร์ตี้ขาดไม่ได้ และในเซิร์ฟเวอร์นี้สายตีผีก็เล่นได้จริง "
                        + "เพราะ Magnus Exorcismus ทำมาครบแล้ว",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "ซัพพอร์ทเต็มตัว",
                        Suits = "ปาร์ตี้, ซัพพอร์ท",
                        Stats = "INT ▸ DEX ▸ VIT\n"
                                + "• INT 90+ ทั้ง Heal และ SP มาจากตรงนี้\n"
                                + "• DEX 60+ ร่ายไว ซึ่งคือทั้งหมดของการเป็นซัพพอร์ทที่ดี\n"
                                + "• VIT 40+ ตัวเองต้องรอด",
                        Skills = "Heal 10 → Blessing 10 → Increase Agility 10 → Magnificat 5 → "
                                 + "Kyrie Eleison 10 → Gloria 5 → Sanctuary 10 → "
                                 + "Status Recovery 1 → Resurrection 4\n"
                                 + "Kyrie Eleison คือโล่ให้เพื่อน ใช้ก่อนที่เพื่อนจะเจ็บ ไม่ใช่หลัง\n"
                                 + "Sanctuary ฮีลทั้งวงและไล่อันเดด วางไว้ตรงที่ปาร์ตี้ยืน\n"
                                 + "Suffragium ลดเวลาร่ายให้ Wizard ในปาร์ตี้ อย่าลืมกดให้เขา\n"
                                 + "Pneuma กันธนูและสกิลระยะไกล ใช้ตอนล่าบอสจะเห็นค่าทันที",
                        GearEarly = "Mace, Silk Robe, Shoes, Muffler, Rosary",
                        GearMid = "Golden Mace, Saint's Robe, Boots, Manteau, Clip, Biretta",
                        GearLate = "Golden Mace +10, Saint's Robe, Boots, Manteau, Rosary สองวง",
                        Cards = "เครื่องประดับ: Phen Card (ร่ายไม่ถูกขัด) — เกือบบังคับ\n"
                                + "เครื่องประดับ: Zerom Card (DEX +3)\n"
                                + "เสื้อ: Marc Card (กันแช่แข็ง 100%) — Priest ที่โดนแช่คือปาร์ตี้ล่ม\n"
                                + "รองเท้า: Sohee Card (SP +15%) หรือ Eggyra Card (ฟื้น SP +15%)\n"
                                + "โล่: Thara Frog Card (ลดดาเมจจากคน 30%)\n"
                                + "<b>ระดับ 3</b> Pharaoh Card (SP ที่ใช้ -30%) หรือ "
                                + "Amon Ra Card (สเตตัสทุกตัว +1 และอื่น ๆ)",
                    },
                    new GuideBuild
                    {
                        Name = "ตีผี (Magnus Exorcismus)",
                        Suits = "ลุยเดี่ยว, ไต่เลเวลเร็ว",
                        Stats = "INT ▸ DEX ▸ VIT\n"
                                + "• INT 90+ ดาเมจทั้งหมดมาจาก INT\n"
                                + "• DEX 60+ Magnus ร่ายนานมาก\n"
                                + "• VIT 40+ เพราะต้องยืนอยู่ในวงตัวเอง",
                        Skills = "Heal 10 → Ruwach 1 → Lex Divina 5 → Lex Aeterna 1 → "
                                 + "Resurrection 1 → Turn Undead 5 → Safety Wall 1 → "
                                 + "Magnus Exorcismus 10\n"
                                 + "<b>เงื่อนไขจริง:</b> Magnus ต้องมี Safety Wall 1, Lex Aeterna 1, "
                                 + "Turn Undead 3 ครบก่อน\n"
                                 + "วิธีเล่นคือลากมอนอันเดดมารวมกัน วาง Magnus แล้วยืนใน Safety Wall\n"
                                 + "Turn Undead มีโอกาสฆ่าอันเดดทันที ใช้กับตัวที่เลือดเหลือน้อย",
                        GearEarly = "Mace, Silk Robe, Shoes, Muffler",
                        GearMid = "Golden Mace, Saint's Robe, Boots, Manteau, Clip",
                        GearLate = "Golden Mace +10, Saint's Robe, Boots, Manteau",
                        Cards = "เครื่องประดับ: Phen Card (ร่ายไม่ถูกขัด) — Magnus ร่ายนาน ขาดไม่ได้\n"
                                + "รองเท้า: Sohee Card (SP +15%) เพราะ Magnus กินหนักมาก\n"
                                + "เสื้อ: Evil Druid Card (เปลี่ยนธาตุเสื้อเป็นอันเดด, INT +1) — "
                                + "ระวัง: ใส่แล้ว Heal จะรักษาตัวเองไม่ได้\n"
                                + "โล่: Thara Frog Card",
                    },
                },
            },

            //--- Hunter -------------------------------------------------------------
            [10] = new JobGuide
            {
                Job = "Hunter — นายพราน",
                Intro = "ยิงไกล วางกับดัก และมีเหยี่ยวช่วยตี ในเซิร์ฟเวอร์นี้กับดักทำครบทุกอัน "
                        + "เลยเล่นสายกับดักได้จริง ไม่ใช่แค่ของประดับ",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "ธนู (Double Strafe)",
                        Suits = "ลุยเดี่ยว, ล่าบอส",
                        Stats = "DEX ▸ AGI ▸ INT ▸ VIT\n"
                                + "• DEX 90+ ทุ่มก่อน เป็นทั้งดาเมจและความแม่น\n"
                                + "• AGI 70-90 ตีถี่\n"
                                + "• INT 30 พอมี SP ยิงต่อเนื่อง\n"
                                + "• VIT 30",
                        Skills = "Double Strafe 10 → Owl's Eye 10 → Vulture's Eye 10 → "
                                 + "Improve Concentration 10 → Beast Bane 10 → "
                                 + "Falcon Mastery 1 → Blitz Beat 5 → Steel Crow 10\n"
                                 + "Blitz Beat ยิงเองอัตโนมัติด้วย ยิ่ง DEX สูงยิ่งออกบ่อย\n"
                                 + "Steel Crow เพิ่มดาเมจเหยี่ยว ซึ่งเป็นดาเมจฟรีตลอดเวลา\n"
                                 + "ลูกธนูธาตุคือครึ่งหนึ่งของดาเมจ พกให้ครบทุกธาตุ",
                        GearEarly = "Composite Bow, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Cross Bow หรือ Arbalest Bow, Silver Robe, Boots, Manteau, Clip",
                        GearLate = "Hunter Bow หรือ Gakkung Bow +10, Mink Coat, Boots, Manteau, "
                                   + "Apple of Archer",
                        Cards = "อาวุธ: Archer Skeleton Card (ดาเมจระยะไกล +10%)\n"
                                + "อาวุธ: Hydra Card (+20% ใส่คน) ถ้าไปตีมอนตระกูลคน\n"
                                + "เครื่องประดับ: Zerom Card (DEX +3) สองวง\n"
                                + "ผ้าคลุม: Raydric Card หรือ Whisper Card (Flee +20)\n"
                                + "<b>ระดับ 3</b> Phreeoni Card (HIT +100) — ยิงบอสไม่พลาดอีกเลย, "
                                + "หรือ Doppelganger Card (ASPD +10%)",
                    },
                    new GuideBuild
                    {
                        Name = "กับดัก (Trapper)",
                        Suits = "ปาร์ตี้, ล่าบอส, ป้องกันตัว",
                        Stats = "DEX ▸ INT ▸ VIT ▸ AGI\n"
                                + "• DEX 90+ ดาเมจกับดักคิดจาก DEX\n"
                                + "• INT 50+ ดาเมจกับดักคิดจาก INT ด้วย และกินอุปกรณ์เยอะ\n"
                                + "• VIT 40+ เพราะต้องเข้าไปวางกับดักใกล้ ๆ\n"
                                + "• AGI ทีหลัง",
                        Skills = "Land Mine 5 → Skid Trap 1 → Ankle Snare 5 → Flasher 1 → "
                                 + "Freezing Trap 5 → Sandman 1 → Blast Mine 5 → "
                                 + "Shockwave Trap 1 → Claymore Trap 5 → Remove Trap 1\n"
                                 + "Ankle Snare คือของจริง ตรึงบอสไว้กับที่แล้วค่อยยิง\n"
                                 + "Claymore Trap แรงสุดในบรรดากับดัก แต่ต้องมี Blast Mine ก่อน\n"
                                 + "Remove Trap เก็บกับดักคืนได้ อย่าลืมกด ไม่งั้นเปลืองของมาก\n"
                                 + "Spring Trap ปลดกับดักของคนอื่นจากระยะไกล",
                        GearEarly = "Composite Bow, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Cross Bow, Silver Robe, Boots, Manteau, Clip",
                        GearLate = "Hunter Bow +10, Mink Coat, Boots, Manteau",
                        Cards = "เครื่องประดับ: Zerom Card (DEX +3) สองวง\n"
                                + "หมวก/เสื้อ: Elder Willow Card (INT +2) — เพิ่มดาเมจกับดักตรง ๆ\n"
                                + "รองเท้า: Sohee Card (SP +15%) เพราะวางกับดักกิน SP ตลอด\n"
                                + "ผ้าคลุม: Raydric Card\n"
                                + "โล่: Horn Card (ลดดาเมจระยะไกล 35%) เวลาโดนยิงกลับ",
                    },
                },
            },

            //--- Assassin -----------------------------------------------------------
            [11] = new JobGuide
            {
                Job = "Assassin — นักฆ่า",
                Intro = "อาชีพเดียวที่ถืออาวุธสองมือได้ และเป็นสายคริติคอลที่ดีที่สุดในเกม "
                        + "หายตัวได้ด้วย เข้าออกได้ทุกที่",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "กรงเล็บคริติคอล (Katar)",
                        Suits = "ลุยเดี่ยว",
                        Stats = "AGI ▸ LUK ▸ STR ▸ VIT\n"
                                + "• AGI 90+ ทั้งหลบและตีถี่\n"
                                + "• LUK 60-90 คริติคอลมาจาก LUK และ Katar คริเป็นสองเท่า\n"
                                + "• STR 40-60\n"
                                + "• คริติคอลไม่สนใจ DEF และไม่พลาด เลยไม่ต้องลง DEX เลย",
                        Skills = "Katar Mastery 10 → Right Hand Mastery 5 → Sonic Blow 10 → "
                                 + "Cloaking 3 → Grimtooth 5\n"
                                 + "สายนี้ตีธรรมดาก็แรงแล้ว Sonic Blow ไว้เก็บตัวที่ต้องรีบ\n"
                                 + "Cloaking เดินหายตัวได้ ใช้เข้าไปในดันเจี้ยนที่มอนแรงกว่าเรา\n"
                                 + "Grimtooth ตีจากในสถานะหายตัว ระยะไกลกว่าปกติ",
                        GearEarly = "Jur, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Katar หรือ Katar of Quaking, Silver Robe, Boots, Manteau, Clip",
                        GearLate = "Jamadhar หรือ Infiltrator +10, Mink Coat, Boots, Manteau",
                        Cards = "อาวุธ: Soldier Skeleton Card (คริ +9) — สายนี้ต้องการใบนี้ที่สุด\n"
                                + "อาวุธ: Kobold Card (คริ +4, STR +1) ใส่เสริม\n"
                                + "เครื่องประดับ: Kukre Card (AGI +2) สองวง\n"
                                + "ผ้าคลุม: Whisper Card (Flee +20)\n"
                                + "รองเท้า: Matyr Card (HP +10%, AGI +1)\n"
                                + "<b>ระดับ 3</b> Doppelganger Card (ASPD +10%) — สายคริยิ่งตีถี่ยิ่งแรงเป็นเงา",
                    },
                    new GuideBuild
                    {
                        Name = "กริชสองมือ (Sonic Blow)",
                        Suits = "ลุยเดี่ยว, ล่าบอส",
                        Stats = "STR ▸ AGI ▸ DEX ▸ VIT\n"
                                + "• STR 90+ Sonic Blow คิดจาก ATK ตรง ๆ\n"
                                + "• AGI 60-80\n"
                                + "• DEX 30-40 กริชต้องเข้า ไม่เหมือนสายคริ\n"
                                + "• VIT 30",
                        Skills = "Sonic Blow 10 → Katar Mastery 4 (แค่ปลดล็อก) → "
                                 + "Right Hand Mastery 5 → Left Hand Mastery 5 → "
                                 + "Enchant Poison 5 → Poison React 5\n"
                                 + "ถือกริชสองมือแล้วมือซ้ายตีได้ครึ่งแรง Left Hand Mastery แก้ตรงนั้น\n"
                                 + "Enchant Poison ใส่ธาตุพิษให้อาวุธ ดีกับมอนที่ไม่กันพิษ\n"
                                 + "Venom Splasher ระเบิดมอนที่ติดพิษ แรงมากแต่เปลืองของ",
                        GearEarly = "Main Gauche คู่, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Gladius คู่, Silver Robe, Boots, Manteau, Clip",
                        GearLate = "Damascus หรือ Ice Pick +10, Mink Coat, Boots, Manteau",
                        Cards = "อาวุธ: Hydra Card (+20% ใส่คน) ใส่ได้หลายใบในกริชหลายรู\n"
                                + "อาวุธ: Andre Card (ATK +20) ถ้าอยากได้แรงกลาง ๆ ทุกเป้า\n"
                                + "เครื่องประดับ: Mantis Card (STR +3) สองวง\n"
                                + "ผ้าคลุม: Raydric Card\n"
                                + "<b>ระดับ 3</b> Turtle General Card (ดาเมจ +20% ทุกเป้า) — "
                                + "ใบนี้ดีกับสายตีทุกอาชีพ",
                    },
                },
            },

            //--- Blacksmith ---------------------------------------------------------
            [12] = new JobGuide
            {
                Job = "Blacksmith — ช่างตีเหล็ก",
                Intro = "ตีแรงที่สุดต่อหนึ่งครั้งในบรรดาสายกายภาพ และเป็นอาชีพเดียวที่ตีอาวุธเองได้ "
                        + "เหมาะกับคนที่ชอบสะสมและทำของ",
                Builds = new[]
                {
                    new GuideBuild
                    {
                        Name = "สายตี (Adrenaline Rush)",
                        Suits = "ลุยเดี่ยว, ปาร์ตี้",
                        Stats = "STR ▸ DEX ▸ VIT ▸ AGI\n"
                                + "• STR 90+ ทุ่มก่อน\n"
                                + "• DEX 50-70 ค้อนกับขวานตีพลาดง่าย\n"
                                + "• VIT 40+ ต้องยืนตี\n"
                                + "• AGI ไม่ต้องเยอะ เพราะ Adrenaline Rush เพิ่ม ASPD ให้อยู่แล้ว",
                        Skills = "Hilt Binding 1 → Weaponry Research 10 → Hammer Fall 5 → "
                                 + "Adrenaline Rush 5 → Weapon Perfection 5 → Power Thrust 5 → "
                                 + "Maximize Power 5 → Mammonite 10\n"
                                 + "Adrenaline Rush คือหัวใจ เพิ่มความเร็วโจมตีให้ทั้งปาร์ตี้ด้วย\n"
                                 + "Weapon Perfection ทำให้ไม่มีโทษเรื่องขนาดมอนอีกเลย\n"
                                 + "Maximize Power ดาเมจสูงสุดตลอดเวลา แต่กิน SP ทุกวินาที เปิดเฉพาะตอนตี\n"
                                 + "Hammer Fall ทำสตันเป็นวง ใช้ก่อนเข้าตีเสมอ",
                        GearEarly = "Battle Axe, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Hammer หรือ Buster, Chain Mail, Boots, Manteau, Clip, Helm",
                        GearLate = "Two-Handed Axe หรือ Great Axe +10, Full Plate, Greaves, Manteau",
                        Cards = "อาวุธ: Hydra Card ผสม Minorous Card (+15% ตัวใหญ่)\n"
                                + "อาวุธ: Andre Card (ATK +20) ถ้าอยากได้แรงเท่ากันทุกเป้า\n"
                                + "เสื้อ: Peco Peco Card (HP สูงสุด +10%)\n"
                                + "รองเท้า: Verit Card (HP และ SP +8%) เพราะ Maximize Power กิน SP\n"
                                + "ผ้าคลุม: Raydric Card\n"
                                + "<b>ระดับ 3</b> Turtle General Card (ดาเมจ +20% ทุกเป้า) หรือ "
                                + "Tao Gunka Card (HP +100%) ถ้ามีคนฮีลให้",
                    },
                    new GuideBuild
                    {
                        Name = "รถเข็น (Cart Revolution) และทำของ",
                        Suits = "หาเงิน, ปาร์ตี้",
                        Stats = "STR ▸ DEX ▸ VIT\n"
                                + "• STR 80+ Cart Revolution คิดจากน้ำหนักของในรถเข็นด้วย\n"
                                + "• DEX 50+\n"
                                + "• VIT 40+\n"
                                + "• ถ้าจะตีอาวุธจริงจัง เผื่อ DEX และ LUK ไว้ด้วย มีผลกับอัตราสำเร็จ",
                        Skills = "Push Cart 10 → Crazy Uproar 1 → Cart Revolution 5 → "
                                 + "Hilt Binding 1 → Weaponry Research 10 → Iron Tempering 5 → "
                                 + "Steel Tempering 5 → Enchanted Stone Craft 5 → Ore Discovery 1 → "
                                 + "Smith Blade Weapon / Smith Blunt Weapon / Smith Piercing Weapon\n"
                                 + "Cart Revolution ตีเป็นวง ใส่ของหนักในรถเข็นแล้วแรงขึ้น\n"
                                 + "สายทำของต้องเก็บ Tempering กับ Research ให้ครบก่อน "
                                 + "ไม่งั้นตีอาวุธพังตลอด",
                        GearEarly = "Axe, Adventurer's Suit, Shoes, Muffler",
                        GearMid = "Battle Axe, Chain Mail, Boots, Manteau, Clip",
                        GearLate = "Two-Handed Axe +10, Full Plate, Greaves, Manteau",
                        Cards = "อาวุธ: Andre Card (ATK +20)\n"
                                + "เสื้อ: Pupa Card (HP +700)\n"
                                + "รองเท้า: Verit Card (HP และ SP +8%)\n"
                                + "เครื่องประดับ: Mantis Card (STR +3) — ทั้งตีแรงขึ้นและแบกของได้มากขึ้น\n"
                                + "ผ้าคลุม: Raydric Card",
                    },
                },
            },
        };

        public static JobGuide For(int jobId)
        {
            return Guides.TryGetValue(jobId, out var guide) ? guide : null;
        }
    }
}
