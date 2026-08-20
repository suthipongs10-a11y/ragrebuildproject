using System.Text;
using Assets.Scripts.Network;
using UnityEngine;

namespace Assets.Scripts.UI.Guild
{
    /// <summary>
    /// What the guild skills are called and what they are currently worth.
    ///
    /// Two places need the same answer - the skill list in the guild window and the buff
    /// sitting on the status bar - and a second copy of these numbers is exactly the kind
    /// that ends up one level out of step with the first without anybody noticing. The
    /// levels are read from <see cref="GuildState"/> every time rather than kept, so a
    /// skill raised while a tooltip is open shows the new number the next time it opens.
    /// </summary>
    public static class GuildSkillText
    {
        /// <summary>
        /// What a skill is called here, keyed off the server's own name.
        ///
        /// Falls back to the server's name for anything not in this list, so a skill added
        /// later shows up in English rather than not at all.
        /// </summary>
        public static string NameInThai(GuildSkillInfo skill)
        {
            switch (skill.Name)
            {
                case "Leadership": return "ความเป็นผู้นำ";
                case "Glory of Guild": return "เกียรติภูมิกิลด์";
                case "Sharp Gaze": return "สายตาเฉียบคม";
                case "Regeneration": return "ฟื้นฟูพลัง";
                case "Guild Blessing": return "พรแห่งกิลด์";
                default: return skill.Name;
            }
        }

        /// <summary>
        /// What the skill gives at the level it is at, or what a level of it is worth when
        /// it has not been learned yet.
        /// </summary>
        public static string Effect(GuildSkillInfo skill)
        {
            var lvl = Mathf.Max(skill.Level, 0);
            switch (skill.Name)
            {
                case "Leadership": return lvl > 0 ? $"STR +{lvl}" : "STR +1 ต่อเลเวล";
                case "Glory of Guild": return lvl > 0 ? $"VIT +{lvl}" : "VIT +1 ต่อเลเวล";
                case "Sharp Gaze": return lvl > 0 ? $"DEX +{lvl * 2}" : "DEX +2 ต่อเลเวล";
                case "Regeneration": return lvl > 0 ? $"ฟื้น HP +{lvl * 10}%" : "ฟื้น HP +10% ต่อเลเวล";
                case "Guild Blessing": return lvl > 0 ? $"EXP +{lvl * 2}%" : "EXP +2% ต่อเลเวล";
                default: return "";
            }
        }

        /// <summary>
        /// The lines that go under the guild buff's description: every skill the guild has
        /// actually raised, and what each is giving right now.
        ///
        /// Only learned skills, because the buff is a statement about what is being
        /// received - the full list including the untaken ones is the guild window's job.
        /// Empty when there is nothing to say, which the caller reads as "add nothing"
        /// rather than printing a heading over a blank space.
        /// </summary>
        public static string BuffSummary()
        {
            if (!GuildState.InGuild)
                return "";

            var sb = new StringBuilder();

            foreach (var skill in GuildState.Skills)
            {
                if (skill == null || skill.Level <= 0)
                    continue;

                var effect = Effect(skill);
                if (string.IsNullOrEmpty(effect))
                    continue;

                if (sb.Length > 0)
                    sb.Append('\n');

                sb.Append($"{NameInThai(skill)} <color=#888888>Lv.{skill.Level}</color>  <color=#66CCFF>{effect}</color>");
            }

            if (sb.Length == 0)
                return "";

            var title = string.IsNullOrEmpty(GuildState.GuildName)
                ? "สกิลกิลด์"
                : $"สกิลกิลด์ {GuildState.GuildName}";

            return $"<color=#888888>{title}</color>\n{sb}";
        }
    }
}
