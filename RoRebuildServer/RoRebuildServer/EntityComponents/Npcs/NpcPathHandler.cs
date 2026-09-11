using System.Diagnostics;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RoRebuildServer.EntitySystem;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Skills;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.EntityComponents.Npcs
{
    public class NpcPathHandler(Npc npc)
    {
        public Npc Npc = npc;
        public int Step;
        public NpcPathUpdateResult LastResult;
        private int speed;
        private float waitEndTime;
        private Entity currentTarget;

        public const int StorageCount = 10;

        public int[] ValuesInt = new int[StorageCount];
        public string?[] ValuesString = new string[StorageCount];

        public void SetSpeed(int newSpeed) => speed = newSpeed;
        public void Wait(int time) => waitEndTime = time / 1000f + Time.ElapsedTimeFloat;

        public bool FindPlayerNearby(int range)
        {
            Debug.Assert(Npc.Character.Map != null);

            using var entities = EntityListPool.Get();
            Npc.Character.Map.GatherPlayersInRange(Npc.Character.Position, range, entities, true, false);
            if (entities.Count <= 0)
                return false;
            if (entities.Count == 1)
                currentTarget = entities[0];
            else
                currentTarget = entities[GameRandom.Next(0, entities.Count)];

            return true;
        }

        //public void Hide()
        //{
        //    var ch = Npc.Character;
        //    if (ch.Hidden || ch.Map == null)
        //        return;

        //    ch.Map.RemoveEntity(ref ch.Entity, CharacterRemovalReason.OutOfSight, false);
        //    ch.Hidden = true;
        //}

        //public void Reveal()
        //{
        //    var ch = Npc.Character;
        //    if (!ch.Hidden)
        //        return;


        //    if (ch.Map == null)
        //        throw new Exception($"NPC {ch} attempting to execute AdminUnHide, but the npc is not currently attached to a map.");

        //    ch.Hidden = false;
        //    ch.Map.AddEntity(ref ch.Entity, false);
        //}

        public int Random(int min, int max) => GameRandom.Next(min, max);

        public void LookAtTarget()
        {
            if (currentTarget.TryGet<WorldObject>(out var targetChara))
                Npc.Character.ChangeLookDirection(targetChara.Position);
        }

        public void Say(string text)
        {
            Npc.Character.Map!.AddVisiblePlayersAsPacketRecipients(Npc.Character);
            CommandBuilder.SendSayMulti(Npc.Character, Npc.Character.Name, text, PlayerChatType.Say);
            CommandBuilder.ClearRecipients();
        }

        public void Emote(int id)
        {
            Npc.Character.Map!.AddVisiblePlayersAsPacketRecipients(Npc.Character);
            CommandBuilder.SendEmoteMulti(Npc.Character, id);
            CommandBuilder.ClearRecipients();
        }

        public void PathTo(int x, int y)
        {
            Debug.Assert(Npc.Character.Map != null);
            Npc.Character.MoveSpeed = speed / 1000f;
            if (!Npc.Character.TryMove(new Position(x, y), 0))
                Npc.Character.Map.TeleportEntity(ref Npc.Entity, Npc.Character, new Position(x, y), CharacterRemovalReason.OutOfSight, false);
        }


        public void PathToTarget(int distance = 1)
        {
            if (!currentTarget.TryGet<WorldObject>(out var target))
                return;
            Npc.Character.MoveSpeed = speed / 1000f;
            Npc.Character.TryMove(target.Position, distance);
        }

        /// <summary>
        /// Walks somewhere nearby that the map says can be walked on, rather than somewhere
        /// written into the script.
        /// </summary>
        /// <remarks>
        /// A wandering npc written with PathTo needs a route of hand-picked cells, and a cell
        /// picked by hand is picked without the walk data in front of you: get one wrong and
        /// PathTo quietly teleports rather than walks. This asks the map instead, so the same
        /// script can be dropped on a field nobody has surveyed and still stay on the ground.
        /// </remarks>
        public void PathToRandomTile(int distance)
        {
            Debug.Assert(Npc.Character.Map != null);

            Npc.Character.MoveSpeed = speed / 1000f;

            //Tried a few times because the picked cell can be the one already stood on, or a
            //cell with no route to it; a wander that gives up on the first miss stands still.
            for (var attempt = 0; attempt < 8; attempt++)
            {
                var pos = Npc.Character.Map.GetRandomVisiblePositionInArea(Npc.Character.Position, distance / 2, distance);
                if (pos == Npc.Character.Position)
                    continue;
                if (Npc.Character.TryMove(pos, 0))
                    return;
            }
        }

        /// <summary>
        /// Hands one skill to the player this npc is standing in front of, as though they had
        /// cast it on themselves a moment from now.
        /// </summary>
        /// <remarks>
        /// Through the player's own indirect cast queue - the same queue an autospell card
        /// uses - rather than by writing the status onto them here. An npc has no combat
        /// entity to cast from, and every one of these buffs already has a handler that knows
        /// its own duration, its own strength and what to do about the odd cases: Kyrie sizes
        /// its barrier off the target's max hp, Blessing cleanses curse instead of buffing a
        /// cursed target, Aspersio wants a holy water unless the cast is indirect - which this
        /// one is. Rebuilding any of that here would mean two copies of it, and the copy here
        /// would be the one nobody updates.
        ///
        /// The delay is what makes a handful of these read as a blessing rather than as a
        /// single flash: the queue is kept in cast-time order, so buffs handed over together
        /// with staggered delays land one after another, each with its own effect.
        /// </remarks>
        public bool BuffTarget(string skillName, int level, int delayMs = 0)
        {
            if (!Enum.TryParse<CharacterSkill>(skillName, true, out var skill))
            {
                ServerLogger.LogWarning($"Npc {Npc.Character.Name} asked to hand out '{skillName}', which is not a skill.");
                return false;
            }

            //The player may have walked off, logged out or died between being found and being
            //reached, and any of those makes this a no-op rather than a problem.
            if (!currentTarget.TryGet<WorldObject>(out var chara)
                || chara.Type != CharacterType.Player
                || chara.State == CharacterState.Dead)
                return false;

            var player = chara.Player;
            if (player.IndirectCastQueue == null!)
                return false;

            var cast = new SkillCastInfo()
            {
                Skill = skill,
                Level = level,
                TargetEntity = currentTarget,
                TargetedPosition = chara.Position,
                IsIndirect = true,
                CastTime = Time.ElapsedTimeFloat + delayMs / 1000f
            };

            player.IndirectCastQueue.Add(cast);
            player.IndirectCastQueue.Sort((a, b) => a.CastTime.CompareTo(b.CastTime));
            return true;
        }

        public void UpdatePath()
        {
            if (Step > 0)
            {
                if (LastResult == NpcPathUpdateResult.WaitForMove && !Npc.Character.IsAtDestination)
                    return;
                if (LastResult == NpcPathUpdateResult.WaitForTime && waitEndTime > Time.ElapsedTimeFloat)
                    return;
            }

            var curStep = Step;

            var res = Npc.Behavior.OnPath(Npc, this);

            if (res == NpcPathUpdateResult.EndPath && Step == curStep)
                Npc.EndPath();

            LastResult = res;
        }
    }
}