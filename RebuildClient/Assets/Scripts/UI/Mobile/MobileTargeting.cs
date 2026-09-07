using Assets.Scripts.Network;
using RebuildSharedData.Enum;
using UnityEngine;

namespace Assets.Scripts.UI.Mobile
{
    /// <summary>
    /// Aiming, for a screen with no cursor.
    /// </summary>
    /// <remarks>
    /// On a desktop a targeted skill is pressed and then carried to a monster on the cursor.
    /// A phone has no cursor and no hover: the same press leaves the skill armed and waiting
    /// for a click on something small and moving, behind a thumb, on a screen the size of a
    /// hand. In practice that meant the skill went off on the ground, or not at all.
    ///
    /// So the press aims itself. Whatever the skill wanted - a monster, or a patch of floor -
    /// it is given the nearest thing that fits and fired immediately. Nothing is armed, so
    /// nothing can be left armed.
    ///
    /// The choosing is the same rule the attack button uses, and deliberately so: two buttons
    /// on the same screen that each pick "the enemy" and disagree about which one is worse
    /// than either rule on its own.
    /// </remarks>
    public static class MobileTargeting
    {
        /// <summary>
        /// How far a skill will reach for a target on its own, in world units.
        ///
        /// Wider than the attack button's reach, because a spell is thrown rather than swung
        /// and a caster stands back from what they are hitting.
        /// </summary>
        public const float SkillSearchRange = 40f;

        /// <summary>
        /// The closest thing worth hitting, or null when there is nothing.
        /// </summary>
        /// <remarks>
        /// Mirrors the canClickEnemy test in CameraFollower. A monster is not flagged
        /// IsAttackable - that flag is only set on traps - so what actually marks a valid
        /// target is being a non-NPC the server told us we may interact with.
        /// </remarks>
        public static ServerControllable NearestEnemy(float range)
        {
            var camera = CameraFollower.Instance;
            var player = camera != null ? camera.Target : null;
            if (player == null || NetworkManager.Instance == null)
                return null;

            ServerControllable best = null;
            var bestDistance = range;

            foreach (var entity in NetworkManager.Instance.EntityList.Values)
            {
                if (!IsValidTarget(entity))
                    continue;

                var distance = Vector3.Distance(player.transform.position, entity.transform.position);
                if (distance >= bestDistance)
                    continue;

                best = entity;
                bestDistance = distance;
            }

            return best;
        }

        public static bool IsValidTarget(ServerControllable entity)
        {
            if (entity == null || entity.IsMainCharacter || !entity.IsCharacterAlive || entity.IsHidden || entity.IsAlly)
                return false;

            return (entity.CharacterType != CharacterType.NPC && entity.IsInteractable) || entity.IsAttackable;
        }

        /// <summary>
        /// Fires whatever the last press left sitting on the cursor at the nearest enemy.
        /// </summary>
        /// <remarks>
        /// Called right after the press, so the level and the skill are the ones the press
        /// worked out. Returns whether it fired: when it did not - no target in range, or a
        /// skill meant for a friend rather than an enemy - the skill is left on the cursor
        /// exactly as it was, so tapping the target by hand still works and a healer can
        /// still choose who they are healing.
        /// </remarks>
        public static bool TryFireAtNearest()
        {
            var camera = CameraFollower.Instance;
            if (camera == null || !camera.HasSkillOnCursor)
                return false;

            //A friendly skill has no business picking its own target: "whoever is closest"
            //is the wrong answer for a resurrection and an actively bad one for a buff.
            var wanted = camera.CursorSkillTarget;
            if (wanted != SkillTarget.Enemy && wanted != SkillTarget.Ground && wanted != SkillTarget.Any)
                return false;

            var target = NearestEnemy(SkillSearchRange);
            if (target == null)
                return false;

            var network = NetworkManager.Instance;
            if (network == null)
                return false;

            if (camera.IsCursorSkillItem)
                network.SendUseItem(camera.CursorItemId, target.Id);
            else if (wanted == SkillTarget.Ground)
                //a ground spell lands on the tile the target is standing on, which is where
                //it would have been dropped by hand
                network.SendGroundTargetSkillAction(
                    new Vector2Int(Mathf.RoundToInt(target.transform.position.x),
                        Mathf.RoundToInt(target.transform.position.z)),
                    camera.CursorSkill, camera.CursorSkillLevel);
            else
                network.SendSingleTargetSkillAction(target.Id, camera.CursorSkill, camera.CursorSkillLevel);

            camera.CancelSkillOnCursor();
            return true;
        }
    }
}
