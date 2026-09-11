using MemoryPack;
using System.Diagnostics;
using RebuildSharedData.ClientTypes;
using RebuildSharedData.Data;
using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RebuildSharedData.Networking;
using RebuildSharedData.Packets;
using RebuildZoneServer.Networking;
using RoRebuildServer.Data;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Character;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.EntityComponents.Npcs;
using RoRebuildServer.EntitySystem;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking.PacketHandlers.NPCPackets;
using RoRebuildServer.Simulation;
using RoRebuildServer.Simulation.Guilds;
using RoRebuildServer.Simulation.Items;
using RoRebuildServer.Simulation.Parties;
using RoRebuildServer.Simulation.Trading;
using RoRebuildServer.Simulation.Pathfinding;
using RoRebuildServer.Simulation.StatusEffects.Setup;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Networking;

public static partial class CommandBuilder
{
    [ThreadStatic] private static List<NetworkConnection>? recipients;

    [ThreadStatic] private static List<NetworkConnection>? storedRecipients;

    public static void AddRecipient(Entity e)
    {
        if (!e.IsAlive())
            return;

        if (recipients == null)
            recipients = new List<NetworkConnection>(10);

        var player = e.Get<Player>();
        recipients.Add(player.Connection);
    }

    public static void AddRecipient(NetworkConnection n)
    {
        if (recipients == null)
            recipients = new List<NetworkConnection>(10);

        if (recipients.Contains(n))
            return;

        recipients.Add(n);
    }


    public static void AddRecipients(EntityList? list)
    {
        if (list == null)
            return;

        foreach (var e in list)
        {
            AddRecipient(e);
        }
    }

    public static void EnsureRecipient(Entity entity)
    {
        if (!entity.TryGet<Player>(out var player))
            return;

        if (recipients != null)
            for (var i = 0; i < recipients.Count; i++)
                if (recipients[i] == player.Connection)
                    return;

        AddRecipient(entity);
    }

    public static void StoreRecipients()
    {
        if (recipients == null)
            return;
        if (storedRecipients == null)
            storedRecipients = new List<NetworkConnection>(16);

        storedRecipients.Clear();
        (storedRecipients, recipients) = (recipients, storedRecipients);
    }

    public static void RestoreRecipients()
    {
        if (recipients == null || storedRecipients == null)
            return;

        recipients.Clear();
        (recipients, storedRecipients) = (storedRecipients, recipients);
    }

    public static void AddAllPlayersAsRecipients()
    {
        NetworkManager.AddAllPlayersAsRecipient();
    }

    public static void ClearRecipients()
    {
        recipients?.Clear();
    }

    public static bool HasRecipients()
    {
        return recipients != null && recipients.Count > 0;
    }

    //alternate Move packet that sends floating point walk data
    private static void WriteWalkData2(WorldObject c, OutboundMessage packet)
    {
        Debug.Assert(c.WalkPath != null);
        Debug.Assert(c.IsMoving);
        packet.Write(c.WalkPath[c.MoveStep]);
        packet.Write(c.WorldPosition);
        packet.Write(c.MoveSpeed);
        packet.Write(c.TimeToReachNextStep);
        packet.Write((byte)(c.TotalMoveSteps - c.MoveStep));
        //packet.Write((byte)c.MoveStep);

        if (c.TotalMoveSteps > 0)
        {
            var i = c.MoveStep + 1; //we can derive our starting cell from the MoveStartPosition above

            //pack directions into 2 steps per byte
            while (i < c.TotalMoveSteps)
            {
                var b = (byte)((byte)(c.WalkPath[i] - c.WalkPath[i - 1]).GetDirectionForOffset() << 4);
                i++;
                if (i < c.TotalMoveSteps)
                    b |= (byte)(c.WalkPath[i] - c.WalkPath[i - 1]).GetDirectionForOffset();
                i++;
                packet.Write(b);
            }

            //var lockTime = c.MoveLockTime - Time.ElapsedTimeFloat;
            packet.Write(c.InMoveLock);
        }
    }

    //private static void WriteMoveData(WorldObject c, OutboundMessage packet)
    //{
    //    if (c.WalkPath == null)
    //    {
    //        ServerLogger.LogWarning("Attempting to send empty movepath to player");
    //        return;
    //    }

    //    packet.Write(c.MoveSpeed);
    //    packet.Write(c.MoveProgress);
    //    packet.Write((byte)c.TotalMoveSteps);
    //    packet.Write((byte)c.MoveStep);
    //    if (c.TotalMoveSteps > 0)
    //    {
    //        packet.Write(c.WalkPath[0]);

    //        var i = 1;

    //        //pack directions into 2 steps per byte
    //        while (i < c.TotalMoveSteps)
    //        {
    //            var b = (byte)((byte)(c.WalkPath[i] - c.WalkPath[i - 1]).GetDirectionForOffset() << 4);
    //            i++;
    //            if (i < c.TotalMoveSteps)
    //                b |= (byte)(c.WalkPath[i] - c.WalkPath[i - 1]).GetDirectionForOffset();
    //            i++;
    //            packet.Write(b);
    //        }

    //        var lockTime = c.MoveLockTime - Time.ElapsedTimeFloat;
    //        packet.Write(lockTime > 0 ? lockTime : 0f);
    //    }
    //}

    private static void SerializeEntityDataV2(OutboundMessage packet, WorldObject c, bool isSelf = false)
    {
        var isCombatType = c.Type != CharacterType.NPC;
        var ce = isCombatType ? c.CombatEntity : null;

        var type = c.Type;
        if (c.OverrideAppearanceState != null)
            type = CharacterType.PlayerLikeNpc;

        var entity = new EntitySpawnParameters()
        {
            ServerId = c.Id,
            ClassId = c.ClassId,
            OverrideClassId = c.OverrideClassId,
            Name = c.Name,
            Type = type,
            Facing = c.FacingDirection,
            State = c.State,
            Position = c.Position,
            IsMainCharacter = isSelf
        };

        if (ce != null)
        {
            entity.Level = (byte)ce.GetStat(CharacterStat.Level);
            entity.Hp = ce.GetStat(CharacterStat.Hp);
            entity.MaxHp = ce.GetStat(CharacterStat.MaxHp);
            entity.Sp = isSelf ? ce.GetStat(CharacterStat.Sp) : 0;
            entity.MaxSp = isSelf ? ce.GetStat(CharacterStat.MaxSp) : 0;
            entity.CharacterStatusEffects = ce.StatusContainer?.GetClientSerializationContainer();
        }

        packet.MemoryPackSerializeWithLength(ref entity);

        if (type == CharacterType.Player)
        {
            var player = c.Player;

            var pData = new PlayerSpawnParameters()
            {
                HeadType = (byte)player.GetData(PlayerStat.Head),
                HairColor = (byte)player.GetData(PlayerStat.HairId),
                HeadFacing = player.HeadFacing,
                WeaponClass = (byte)player.MainWeaponClass,
                IsMale = player.IsMale,
                Headgear1 = player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadTop),
                Headgear2 = player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadMid),
                Headgear3 = player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadBottom),
                Weapon = player.Equipment.GetEquipmentIdBySlot(EquipSlot.Weapon),
                Shield = player.Equipment.GetEquipmentIdBySlot(EquipSlot.Shield),
                WeaponElement = player.VisibleWeaponElement,
                PartyId = player.Party?.PartyId ?? -1,
                PartyName = player.Party?.PartyName ?? null,
                GuildName = player.Guild?.GuildName,
                //only worth sending alongside a guild - the plate draws the line only when
                //there is a guild name to hang it off, and a title with no guild is noise
                GuildTitle = player.Guild != null ? player.GuildTitle : null,
                GuildEmblem = player.Guild?.EmblemId ?? 0,
                Follower = player.PlayerFollower
            };

            packet.MemoryPackSerializeWithLength(ref pData);
        }

        if (type == CharacterType.PlayerLikeNpc)
        {
            var npc = c.OverrideAppearanceState!;
            var pData = new PlayerSpawnParameters()
            {
                HeadFacing = npc.HeadFacing,
                HeadType = (byte)npc.HeadType,
                HairColor = (byte)npc.HairColor,
                WeaponClass = (byte)npc.WeaponClass,
                IsMale = npc.IsMale,
                Headgear1 = npc.HeadTop,
                Headgear2 = npc.HeadMid,
                Headgear3 = npc.HeadBottom,
                Weapon = npc.Weapon,
                Shield = npc.Shield,
                Follower = npc.HasCart ? CharacterFollowerState.Cart0 : CharacterFollowerState.None
            };

            packet.MemoryPackSerializeWithLength(ref pData);
        }

        if (type == CharacterType.NPC || type == CharacterType.BattleNpc)
        {
            var npc = c.Npc;
            var display = npc.DisplayType;

            if (display == NpcDisplayType.MaskedEffect && (npc.AreaOfEffect == null || !npc.AreaOfEffect.IsMaskedArea))
                display = NpcDisplayType.Effect;

            var npcData = new NpcSpawnParameters()
            {
                DisplayType = display,
                Interactable = npc.HasInteract,
                EffectType = npc.EffectType,
            };

            if (display == NpcDisplayType.VendingProxy || display == NpcDisplayType.ChatRoomProxy)
            {
                if (!npc.Owner.TryGet<WorldObject>(out var ownerCh))
                {
                    ServerLogger.LogWarning($"Attempting to send vend proxy npc to client, but it's owner {npc.FullName} does not exist!");
                    npcData.OwnerId = -1;
                }
                else
                    npcData.OwnerId = ownerCh.Id;
            }

            packet.MemoryPackSerializeWithLength(ref npcData);

            if (display == NpcDisplayType.MaskedEffect)
            {
                var aoe = npc.AreaOfEffect!;
                packet.Write(aoe.Area);
                var mask = aoe.GetAreaMask()!;
                for (var i = 0; i < aoe.Area.Size; i++)
                    packet.Write(mask[i]);
            }
        }

        if (c.AdminHidden && !isSelf)
            ServerLogger.LogWarning($"We are sending the data of hidden character \"{c.Name}\" to the client!");

        if (c.State == CharacterState.Moving)
        {
            WriteWalkData2(c, packet);
        }
    }

    private static void AddFullEntityData(OutboundMessage packet, WorldObject c, bool isSelf = false)
    {
        var type = c.Type;
        //var isCharacterNpc = false; //npc that has taken a player appearance
        if (c.OverrideAppearanceState != null)
        {
            type = CharacterType.PlayerLikeNpc;
            //isCharacterNpc = true;
        }

        packet.Write(c.Id);
        packet.Write((byte)type);
        packet.Write((short)c.ClassId);
        packet.Write(c.Position);
        packet.Write((byte)c.FacingDirection);
        packet.Write((byte)c.State);

        if (type == CharacterType.PlayerLikeNpc)
        {
            packet.Write((byte)40); //lvl
            packet.Write(1000); //max hp
            packet.Write(1000); //hp
            if (c.OverrideAppearanceState!.HasCart)
            {
                packet.Write(true);
                packet.Write((byte)CharacterStatusEffect.PushCart);
                packet.Write(float.MaxValue);
            }

            packet.Write(false); //statusEffectData
        }
        else if (type == CharacterType.Monster || type == CharacterType.Player || type == CharacterType.BattleNpc)
        {
            var ce = c.Entity.Get<CombatEntity>();
            packet.Write((byte)ce.GetStat(CharacterStat.Level));
            packet.Write(ce.GetStat(CharacterStat.MaxHp));
            packet.Write(ce.GetStat(CharacterStat.Hp));

            var status = ce.StatusContainer;
            if (status == null)
                packet.Write(false);
            else
                status.PrepareCreateEntityMessage(packet);
        }

        if (type == CharacterType.Player || type == CharacterType.PlayerLikeNpc)
        {
            if (type != CharacterType.PlayerLikeNpc)
            {
                var player = c.Entity.Get<Player>();
                packet.Write((byte)player.HeadFacing);
                packet.Write((byte)player.GetData(PlayerStat.Head));
                packet.Write((byte)player.GetData(PlayerStat.HairId));
                packet.Write((byte)player.MainWeaponClass);
                packet.Write(player.IsMale);
                packet.Write(player.Name);
                packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadTop));
                packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadMid));
                packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadBottom));
                packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.Weapon));
                packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.Shield));
                if (isSelf)
                {
                    packet.Write(player.GetStat(CharacterStat.Sp));
                    packet.Write(player.GetStat(CharacterStat.MaxSp));
                }
                else
                {
                    packet.Write(0); //they don't need the sp value for other players
                    packet.Write(0);
                }

                //party
                if (player.Party != null)
                {
                    packet.Write((byte)1);
                    packet.Write(player.Party.PartyId);
                    packet.Write(player.Party.PartyName);
                    //if(isSelf)
                    //    player.Party.SerializePartyInfo(packet);
                }
                else
                    packet.Write((byte)0);

                packet.Write((byte)player.PlayerFollower);

                //packet.Write(isSelf);
            }
            else
            {
                var npc = c.OverrideAppearanceState!;
                packet.Write((byte)npc.HeadFacing);
                packet.Write((byte)npc.HeadType);
                packet.Write((byte)npc.HairColor);
                packet.Write((byte)npc.WeaponClass);
                packet.Write(npc.IsMale);
                packet.Write(c.Name);
                packet.Write(npc.HeadTop);
                packet.Write(npc.HeadMid);
                packet.Write(npc.HeadBottom);
                packet.Write(npc.Weapon);
                packet.Write(npc.Shield);
                packet.Write(0); //sp
                packet.Write(0); //maxsp

                packet.Write((byte)(npc.HasCart ? CharacterFollowerState.Cart0 : CharacterFollowerState.None));
                //packet.Write(false);
            }
        }

        if (type == CharacterType.NPC || type == CharacterType.BattleNpc)
        {
            var npc = c.Entity.Get<Npc>();
            var display = npc.DisplayType;


            if (display == NpcDisplayType.MaskedEffect &&
                (npc.AreaOfEffect == null || !npc.AreaOfEffect.IsMaskedArea))
                display = NpcDisplayType.Effect;
            packet.Write(npc.Name);
            packet.Write((byte)display);
            packet.Write(npc.HasInteract);
            packet.Write((byte)npc.EffectType);
            if (display == NpcDisplayType.MaskedEffect)
            {
                var aoe = npc.AreaOfEffect!;
                packet.Write(aoe.Area);
                var mask = aoe.GetAreaMask()!;
                for (var i = 0; i < aoe.Area.Size; i++)
                    packet.Write(mask[i]);
            }

            if (display == NpcDisplayType.VendingProxy || display == NpcDisplayType.ChatRoomProxy)
            {
                if (!npc.Owner.TryGet<WorldObject>(out var ownerCh))
                {
                    ServerLogger.LogWarning($"Attempting to send vend proxy npc to client, but it's owner {npc.FullName} does not exist!");
                    packet.Write(-1);
                }
                else
                    packet.Write(ownerCh.Id);
            }
        }

        if (c.AdminHidden && !isSelf)
            ServerLogger.LogWarning($"We are sending the data of hidden character \"{c.Name}\" to the client!");

        if (c.State == CharacterState.Moving)
        {
            WriteWalkData2(c, packet);
        }
    }


    private static OutboundMessage BuildCreateEntity2(WorldObject c, CreateEntityEventType entryType, bool isSelf = false)
    {
        //var type = isSelf ? PacketType.EnterServer : PacketType.CreateEntity2;
        var packet = NetworkManager.StartPacket(PacketType.CreateEntity2, 256);
        packet.Write((byte)entryType);

        if (c.AdminHidden && !isSelf)
            ServerLogger.LogWarning($"We are unexpectedly sending data for the hidden object {c} to a player!");

        SerializeEntityDataV2(packet, c, isSelf);

        return packet;
    }

    private static OutboundMessage BuildCreateEntity2(WorldObject c, CreateEntityEventType entryType, Position pos, bool isSelf = false)
    {
        //var type = isSelf ? PacketType.EnterServer : PacketType.CreateEntity2;
        var packet = NetworkManager.StartPacket(PacketType.CreateEntity2, 256);
        packet.Write((byte)entryType);
        packet.Write(pos);

        if (c.AdminHidden && !isSelf)
            ServerLogger.LogWarning($"We are unexpectedly sending data for the hidden object {c} to a player!");

        SerializeEntityDataV2(packet, c, isSelf);

        return packet;
    }


    private static OutboundMessage BuildCreateEntity(WorldObject c, bool isSelf = false)
    {
        var type = isSelf ? PacketType.EnterServer : PacketType.CreateEntity;
        var packet = NetworkManager.StartPacket(type, 256);

        if (c.AdminHidden && !isSelf)
            ServerLogger.LogWarning($"We are unexpectedly sending data for the hidden object {c} to a player!");

        AddFullEntityData(packet, c, isSelf);

        return packet;
    }

    public static void SendUpdatePlayerData(Player p, bool sendInventory = false, bool sendSkills = false, bool sendCart = false)
    {
        var packet = NetworkManager.StartPacket(PacketType.UpdatePlayerData, 512);


        p.SendPlayerUpdateData(packet, sendInventory, sendCart, sendSkills);

        NetworkManager.SendMessage(packet, p.Connection);

        //The bag has just been replaced wholesale, so the names of whatever forged weapons
        //are in it go with it. Here rather than at the eight places that ask for an
        //inventory, so a ninth cannot forget.
        if (sendInventory)
            SendForgedNamesForPlayer(p);
    }

    public static void RefreshGrantedSkills(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.RefreshGrantedSkills, 256);
        if (p.GrantedSkills == null)
            packet.Write((short)0);
        else
        {
            packet.Write((short)p.GrantedSkills.Count);
            foreach (var skill in p.GrantedSkills)
            {
                packet.Write((short)skill.Key);
                packet.Write((byte)skill.Value);
            }
        }

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void PlayerEquipItem(Player player, int bagId, EquipSlot slot, bool isEquip)
    {
        var packet = NetworkManager.StartPacket(PacketType.EquipUnequipGear, 12);
        packet.Write(bagId);
        packet.Write((byte)slot);
        packet.Write(isEquip);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    public static void PlayerUpdateInventoryItemState(Player player, int bagId, UniqueItem item)
    {
        var packet = NetworkManager.StartPacket(PacketType.SocketEquipment, 12);

        packet.Write(bagId);
        item.Serialize(packet);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    public static void UpdatePlayerAppearanceAuto(Player player)
    {
        var packet = NetworkManager.StartPacket(PacketType.UpdateCharacterDisplayState, 48);

        packet.Write(player.Character.Id);
        packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadTop));
        packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadMid));
        packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.HeadBottom));
        packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.Weapon));
        packet.Write(player.Equipment.GetEquipmentIdBySlot(EquipSlot.Shield));
        packet.Write(player.MainWeaponClass);

        //What the blade glow is tinted by. Not derivable from the weapon id on the other
        //side: a forged sword carries its element in a socket and an endow lends one to any
        //weapon, so the answer has to come from here.
        packet.Write((byte)player.VisibleWeaponElement);

        player.Character.Map?.AddVisiblePlayersAsPacketRecipients(player.Character);
        EnsureRecipient(player.Entity);
        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }

    public static void ChangeCombatTargetableState(WorldObject target, bool canInteract)
    {
        var packet = NetworkManager.StartPacket(PacketType.ChangeTargetableState, 8);
        packet.Write(target.Id);
        packet.Write(canInteract);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void StopCastMultiAutoVis(WorldObject caster)
    {
        caster.Map?.AddVisiblePlayersAsPacketRecipients(caster);

        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.StopCast, 8);

        packet.Write(caster.Id);

        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }

    public static void UpdateExistingCastMultiAutoVis(WorldObject caster, float adjustedEndTime)
    {
        caster.Map?.AddVisiblePlayersAsPacketRecipients(caster);
        EnsureRecipient(caster.Entity);
        var packet = NetworkManager.StartPacket(PacketType.UpdateExistingCast, 32);
        packet.Write(caster.Id);
        packet.Write(adjustedEndTime);

        NetworkManager.SendMessageMulti(packet, recipients);

        ClearRecipients();
    }

    public static void ResetMotionAutoVis(WorldObject caster)
    {
        caster.Map?.AddVisiblePlayersAsPacketRecipients(caster);
        EnsureRecipient(caster.Entity);

        var packet = NetworkManager.StartPacket(PacketType.ResetMotion, 8);

        packet.Write(caster.Id);

        NetworkManager.SendMessageMulti(packet, recipients);

        ClearRecipients();
    }

    public static void StopCastMulti(WorldObject caster)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.StopCast, 8);

        packet.Write(caster.Id);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void StartCastMulti(WorldObject caster, WorldObject? target, CharacterSkill skill, int lvl, float castTime, SkillCastFlags flags)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.StartCast, 48);

        packet.Write(caster.Id);
        packet.Write(target?.Id ?? -1);
        packet.Write((byte)skill);
        packet.Write((byte)lvl);
        packet.Write((byte)caster.FacingDirection);
        packet.Write(caster.Position);
        packet.Write(castTime);
        packet.Write((byte)flags);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void StartCastCircleMulti(Position target, int size, float castTime, bool isAlly, bool hasSound)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.CreateCastCircle, 48);

        packet.Write(target);
        packet.Write((byte)size);
        packet.Write(castTime);
        packet.Write(isAlly);
        packet.Write(hasSound);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void StartCastGroundTargetedMulti(WorldObject caster, Position target, CharacterSkill skill, int lvl, int size, float castTime, SkillCastFlags flags)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.StartAreaCast, 48);

        packet.Write(caster.Id);
        packet.Write(target);
        packet.Write((byte)skill);
        packet.Write((byte)lvl);
        packet.Write((byte)size);
        packet.Write((byte)caster.FacingDirection);
        packet.Write(caster.Position);
        packet.Write(castTime);
        packet.Write((byte)flags);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SkillExecuteTargetedSkillAutoVis(WorldObject caster, WorldObject? target, CharacterSkill skill, int lvl, DamageInfo di, bool isIndirect = false)
    {
        caster.Map?.AddVisiblePlayersAsPacketRecipients(caster);
        if (target != null) EnsureRecipient(target.Entity);
        SkillExecuteTargetedSkill(caster, target, skill, lvl, di, isIndirect);
        ClearRecipients();
    }

    public static void SkillExecuteTargetedSkill(WorldObject caster, WorldObject? target, CharacterSkill skill, int lvl, DamageInfo di, bool isIndirect = false)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.Skill, 48);

        packet.Write((byte)SkillTarget.Enemy);
        packet.Write(caster.Id); //the source of the attack

        //the owner of the damage can be different from where the attack is launched from, so inform the client if that's the case
        if (caster.Entity != di.Source)
            packet.Write(di.Source.TryGet<WorldObject>(out var attacker) ? attacker.Id : -1);
        else
            packet.Write(-1);
        packet.Write(target?.Id ?? -1);
        packet.Write((byte)skill);
        packet.Write((byte)lvl);
        packet.Write((byte)caster.FacingDirection);
        packet.Write(caster.Position);
        packet.Write(di.DisplayDamage);
        packet.Write((byte)di.Result);
        packet.Write((byte)di.HitCount);
        packet.Write(di.AttackMotionTime);
        packet.Write(di.Time - Time.ElapsedTimeFloat);
        packet.Write(di.IsIndirect || isIndirect);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SkillExecuteIndirectAutoVisibility(WorldObject caster, WorldObject target, DamageInfo di)
    {
        caster.Map?.AddVisiblePlayersAsPacketRecipients(target);
        CommandBuilder.SkillExecuteIndirect(caster, target, di);
        CommandBuilder.ClearRecipients();
    }

    public static void SkillExecuteIndirect(WorldObject caster, WorldObject target, DamageInfo di)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.SkillIndirect, 48);

        packet.Write(caster.Id);
        packet.Write(target.Id);
        packet.Write(caster.Position);
        packet.Write(di.DisplayDamage);
        packet.Write(di.Time - Time.ElapsedTimeFloat);
        packet.Write((byte)di.AttackSkill);
        packet.Write((byte)di.HitCount);
        packet.Write((byte)di.Result);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SkillExecuteSelfTargetedSkillAutoVis(WorldObject caster, CharacterSkill skill, int lvl, bool isIndirect)
    {
        caster.Map?.AddVisiblePlayersAsPacketRecipients(caster);
        SkillExecuteSelfTargetedSkill(caster, skill, lvl, isIndirect);
        ClearRecipients();
    }

    public static void SkillExecuteSelfTargetedSkill(WorldObject caster, CharacterSkill skill, int lvl, bool isIndirect)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.Skill, 48);

        packet.Write((byte)SkillTarget.Self);
        packet.Write(caster.Id);
        packet.Write((byte)skill);
        packet.Write((byte)lvl);
        packet.Write((byte)caster.FacingDirection);
        packet.Write(caster.Position);
        packet.Write(caster.CombatEntity?.GetTiming(TimingStat.AttackMotionTime) ?? 0);
        packet.Write(isIndirect);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SkillExecuteAreaTargetedSkillAutoVis(WorldObject caster, Position target, CharacterSkill skill, int lvl, float motionTime = -1)
    {
        caster.Map?.AddVisiblePlayersAsPacketRecipients(caster);
        SkillExecuteAreaTargetedSkill(caster, target, skill, lvl, motionTime);
        ClearRecipients();
    }

    public static void SkillExecuteAreaTargetedSkill(WorldObject caster, Position target, CharacterSkill skill, int lvl, float motionTime = -1)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.Skill, 48);

        if (motionTime < 0)
            motionTime = caster.CombatEntity?.GetTiming(TimingStat.AttackMotionTime) ?? 0;

        packet.Write((byte)SkillTarget.Ground);
        packet.Write(caster.Id);
        packet.Write(target);
        packet.Write((byte)skill);
        packet.Write((byte)lvl);
        packet.Write((byte)caster.FacingDirection);
        packet.Write(caster.Position);
        packet.Write(motionTime);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SkillExecuteMaskedAreaTargetedSkill(WorldObject caster, Position target, int range, CharacterSkill skill, int lvl, ref Span<bool> mask, bool isIndirect, float motionTime = -1)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.SkillWithMaskedArea, 128);

        if (motionTime < 0)
            motionTime = caster.CombatEntity?.GetTiming(TimingStat.AttackMotionTime) ?? 0;

        packet.Write(caster.Id);
        packet.Write(target);
        packet.Write((byte)skill);
        packet.Write((byte)lvl);
        packet.Write((byte)caster.FacingDirection);
        packet.Write(caster.Position);
        packet.Write((byte)range);
        packet.Write(motionTime);
        packet.Write(isIndirect);
        for (var i = 0; i < mask.Length; i++)
            packet.Write(mask[i]);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void AttackMulti(WorldObject? attacker, WorldObject target, DamageInfo di, bool showAttackMotion = true)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.Attack, 48);

        var dir = target.FacingDirection;
        if (attacker != null)
            dir = attacker.FacingDirection;

        var pos = target.Position;
        if (attacker != null)
            pos = attacker.Position;

        packet.Write(attacker?.Id ?? -1);
        packet.Write(target.Id);
        packet.Write((byte)dir);
        packet.Write((byte)di.AttackSkill);
        packet.Write((byte)di.HitCount);
        packet.Write((byte)di.Result);
        packet.Write(pos);
        packet.Write(di.DisplayDamage);
        packet.Write(di.DisplayDamageOffHand);
        packet.Write(di.AttackMotionTime);
        packet.Write(di.Time - Time.ElapsedTimeFloat);
        packet.Write(showAttackMotion);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void AttackAutoVis(WorldObject? attacker, WorldObject target, DamageInfo di, bool showAttackMotion = true)
    {
        var hasRecipients = HasRecipients();
        if (hasRecipients)
            StoreRecipients(); //for safety's sake, in case we're triggered from within a function that expects the recipient list to remain unmodified

        target.Map?.AddVisiblePlayersAsPacketRecipients(target);

        AttackMulti(attacker, target, di, showAttackMotion);

        if (hasRecipients)
            RestoreRecipients();
        else
            ClearRecipients();
    }

    public static void TakeDamageMulti(WorldObject target, DamageInfo di)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.TakeDamage, 48);

        //var src = 0;
        //if (di.Source.TryGet<WorldObject>(out var damageSrc))
        //    src = damageSrc.Id;

        packet.Write(target.Id);
        packet.Write(di.Damage);
        packet.Write(di.HitCount);
        packet.Write(di.Time);
        //packet.Write(src);
        //packet.Write((byte)di.AttackSkill);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void ChangeSittingMulti(WorldObject c)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.SitStand, 48);

        packet.Write(c.Id);
        packet.Write(c.State == CharacterState.Sitting);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void ChangeFacingMulti(WorldObject c, Position lookAtPos)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.LookTowards, 48);

        packet.Write(c.Id);
        packet.Write(lookAtPos);
        packet.Write((byte)c.FacingDirection);

        if (c.Type == CharacterType.Player)
        {
            var player = c.Entity.Get<Player>();
            packet.Write((byte)player.HeadFacing);
        }
        else if (c.OverrideAppearanceState != null)
            packet.Write((byte)c.OverrideAppearanceState.HeadFacing);
        else
            packet.Write((byte)0);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void CharacterStopImmediateMulti(WorldObject c)
    {
        var packet = NetworkManager.StartPacket(PacketType.StopImmediate, 32);

        packet.Write(c.Id);
        packet.Write(c.Position);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void CharacterStopMulti(WorldObject c)
    {
        var packet = NetworkManager.StartPacket(PacketType.StopAction, 32);

        packet.Write(c.Id);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendMoveEntityMulti(WorldObject c)
    {
        var packet = NetworkManager.StartPacket(PacketType.Move, 48);

        packet.Write(c.Id);
        packet.Write(c.Position);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    /// <summary>
    /// 
    /// </summary>
    /// <param name="c"></param>
    public static void SendStartMoveEntityMulti(WorldObject c)
    {
        var packet = NetworkManager.StartPacket(PacketType.StartWalk, 256);

        packet.Write(c.Id);
        WriteWalkData2(c, packet);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    /// <summary>
    /// Special action that informs the client that a character will move from their current position to a destination without regards to distance.
    /// </summary>
    //public static void SendMoveToFixedPositionMulti(WorldObject c, Position dest, float time)
    //{
    //    var packet = NetworkManager.StartPacket(PacketType.FixedMove, 32);

    //    packet.Write(c.Id);
    //    packet.Write(dest);
    //    packet.Write(c.MoveSpeed);
    //    packet.Write(time);

    //    NetworkManager.SendMessageMulti(packet, recipients);
    //}
    /// <summary>
    /// Where a tracked entity is reported to be, which for a boss is nowhere in particular.
    /// </summary>
    /// <remarks>
    /// This packet goes to everybody on the map rather than to whoever can see the entity, so
    /// for a boss it was a map wide position feed. Not drawing it on the minimap hides it from
    /// the player looking at the minimap and from nobody else: the number still arrived, and
    /// anything reading the socket could point straight at the boss from across the map. The
    /// position is what leaks, so the position is what is withheld. The id, the fact that one
    /// is standing here, and the removal when it dies all still go - which is everything the
    /// "a boss is alive on this map" badge is built out of, and nothing more.
    ///
    /// Coming into view is separate and still honest: an entity a player can actually see is
    /// spawned to them by the ordinary path, with its real position.
    /// </remarks>
    private static Position TrackedPositionFor(WorldObject o) =>
        o.DisplayType == CharacterDisplayType.Boss || o.DisplayType == CharacterDisplayType.Mvp
            ? Position.Zero
            : o.Position;

    public static void SendAllMapImportantEntities(Player p, EntityList mapImportantEntities)
    {
        var packet = NetworkManager.StartPacket(PacketType.UpdateMapImportantEntityTracking, 64);

        mapImportantEntities.ClearInactive();
        packet.Write((short)mapImportantEntities.Count);
        for (var i = 0; i < mapImportantEntities.Count; i++)
        {
            var chara = mapImportantEntities[i].Get<WorldObject>();
            packet.Write(chara.Id);
            packet.Write(TrackedPositionFor(chara));
            packet.Write((byte)chara.DisplayType);
            if (chara.DisplayType == CharacterDisplayType.Effect)
                packet.Write(chara.Type == CharacterType.NPC && chara.Npc.ParamString != null ? chara.Npc.ParamString : chara.Name);
        }

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendUpdateMapImportantEntityMulti(WorldObject o)
    {
        var packet = NetworkManager.StartPacket(PacketType.UpdateMapImportantEntityTracking, 32);

        packet.Write((short)1);
        packet.Write(o.Id);
        packet.Write(TrackedPositionFor(o));
        packet.Write((byte)o.DisplayType);
        if (o.DisplayType == CharacterDisplayType.Effect)
            packet.Write(o.Type == CharacterType.NPC && o.Npc.ParamString != null ? o.Npc.ParamString : o.Name);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendRemoveMapImportantEntityMulti(WorldObject o)
    {
        var packet = NetworkManager.StartPacket(PacketType.UpdateMapImportantEntityTracking, 32);

        packet.Write((short)1);
        packet.Write(o.Id);
        packet.Write(Position.Invalid);
        packet.Write((byte)o.DisplayType);
        if (o.DisplayType == CharacterDisplayType.Effect)
            packet.Write(o.Type == CharacterType.NPC && o.Npc.ParamString != null ? o.Npc.ParamString : o.Name);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendServerMessage(string text, string name = "Server", bool playNoticeSound = false)
    {
        var packet = NetworkManager.StartPacket(PacketType.Say, 364);
        var type = playNoticeSound ? PlayerChatType.Notice : PlayerChatType.Say;

        packet.Write(-1);
        packet.Write(text);
        packet.Write(name);
        packet.Write((byte)type);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendServerEvent(Player p, ServerEvent eventType, int id = 0, string text = "")
    {
        var packet = NetworkManager.StartPacket(PacketType.ServerEvent, 128);

        packet.Write((byte)eventType);
        packet.Write(id);
        packet.Write(text);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>
    /// The same packet as SendServerEvent, sent to everyone currently in the recipient
    /// list rather than to one player. Used for announcements, which are the only server
    /// event that is about somebody other than the person reading it.
    /// </summary>
    public static void SendServerEventMulti(ServerEvent eventType, int id = 0, string text = "")
    {
        var packet = NetworkManager.StartPacket(PacketType.ServerEvent, 128);

        packet.Write((byte)eventType);
        packet.Write(id);
        packet.Write(text);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendActionResult(Player p, ServerResult eventType, int id = 0, string text = "")
    {
        var packet = NetworkManager.StartPacket(PacketType.ServerResult, 128);

        packet.Write((byte)eventType);
        packet.Write(id);
        packet.Write(text);

        NetworkManager.SendMessage(packet, p.Connection);
    }


    public static void SendSayMulti(WorldObject? c, string name, string text, PlayerChatType type)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.Say, 364);

        if (c == null)
            packet.Write(-1);
        else
            packet.Write(c.Id);
        packet.Write(text);
        packet.Write(name);
        packet.Write((byte)type);

        NetworkManager.SendMessageMulti(packet, recipients);
    }


    public static void SendEmoteMulti(WorldObject c, int emote)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.Emote, 32);

        packet.Write(c.Id);
        packet.Write(emote);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendChangeNameMulti(WorldObject c, string text)
    {
        var packet = NetworkManager.StartPacket(PacketType.ChangeName, 96);

        packet.Write(c.Id);
        packet.Write(text);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void InformEnterServer(WorldObject c, Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.EnterServer, 32);
        packet.Write(c.Id);
        Debug.Assert(c.Map != null, $"Player {p} not attached to map to inform of server enter.");
        packet.Write(c.Map.Name);
        packet.Write(c.Player.Id.ToByteArray());

        NetworkManager.SendMessage(packet, p.Connection);
        SendUpdatePlayerData(p, true, true, true);
    }

    public static void SendCreateEntityMulti(WorldObject c, CreateEntityEventType entryType = CreateEntityEventType.Normal)
    {
        if (!HasRecipients())
            return;

        //var packet = BuildCreateEntity(c);
        //packet.Write((byte)entryType);
        //NetworkManager.SendMessageMulti(packet, recipients);

        //ServerLogger.Debug($"Sending duplicate CreateEntityV2, be sure to remove this at some point.");

        var packet = BuildCreateEntity2(c, entryType);
        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendCreateEntity(WorldObject c, Player player, CreateEntityEventType entryType = CreateEntityEventType.Normal)
    {
        //var packet = BuildCreateEntity(c);
        //packet.Write((byte)entryType);
        //NetworkManager.SendMessage(packet, player.Connection);

        //ServerLogger.Debug($"Sending duplicate CreateEntityV2, be sure to remove this at some point.");

        var packet = BuildCreateEntity2(c, entryType);
        NetworkManager.SendMessage(packet, player.Connection);
    }

    public static void SendCreateEntityWithEventMulti(WorldObject c, CreateEntityEventType eventType, Position pos)
    {
        if (!HasRecipients())
            return;

        //var packet = BuildCreateEntity(c);
        //packet.Write((byte)eventType);
        //packet.Write(pos);
        //NetworkManager.SendMessageMulti(packet, recipients);

        //ServerLogger.Debug($"Sending duplicate CreateEntityV2, be sure to remove this at some point.");

        var packet = BuildCreateEntity2(c, eventType, pos);
        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendRemoveEntityMulti(WorldObject c, CharacterRemovalReason reason, float value = -1)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.RemoveEntity, 32);
        packet.Write(c.Id);
        packet.Write((byte)reason);
        packet.Write(value);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendRemoveEntity(WorldObject c, Player player, CharacterRemovalReason reason)
    {
        var packet = NetworkManager.StartPacket(PacketType.RemoveEntity, 32);
        packet.Write(c.Id);
        packet.Write((byte)reason);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    public static void SendRemoveAllEntities(Player player)
    {
        var packet = NetworkManager.StartPacket(PacketType.RemoveAllEntities, 8);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    public static void SendChangeMap(WorldObject c, Player player)
    {
        if (c.Map == null)
        {
            ServerLogger.LogWarning($"Trying to send change map for player {player.Name} while the player does not currently have a map.");
            return;
        }

        var packet = NetworkManager.StartPacket(PacketType.ChangeMaps, 128);

        packet.Write(c.Map.Name);
        //packet.Write(c.Position);

        NetworkManager.SendMessage(packet, player.Connection);
    }

    public static void SendChangeTarget(Player p, WorldObject? target)
    {
        var packet = NetworkManager.StartPacket(PacketType.ChangeTarget, 32);

        packet.Write(target?.Id ?? 0);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendMonsterTarget(Player p, WorldObject attacker)
    {
        var packet = NetworkManager.StartPacket(PacketType.Targeted, 32);

        packet.Write(attacker.Id);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendPlayerDeath(WorldObject c)
    {
        var packet = NetworkManager.StartPacket(PacketType.Death, 16);
        packet.Write(c.Id);
        packet.Write(c.Position);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendPlayerResurrection(WorldObject c)
    {
        var packet = NetworkManager.StartPacket(PacketType.Resurrection, 16);
        packet.Write(c.Id);
        packet.Write(c.Position);

        var hp = 0;
        if (c.Type == CharacterType.Player)
            hp = c.Player.GetStat(CharacterStat.Hp);

        packet.Write(hp);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendHitMulti(WorldObject c, int damage, bool isHitStopped)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.HitTarget, 32);
        packet.Write(c.Id);
        //packet.Write(delayTime);
        packet.Write(damage);
        packet.Write(c.Position);
        packet.Write(c.InMoveLock && isHitStopped);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendEffectOnCharacterMulti(WorldObject p, int effectId)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.EffectOnCharacter, 16);
        packet.Write(p.Id);
        packet.Write(effectId);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendEffectAtLocationMulti(int effectId, Position pos, int facing)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.EffectAtLocation, 16);
        packet.Write(effectId);
        packet.Write(pos);
        packet.Write(facing);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendPlaySoundAtLocationMulti(string fileName, Position pos)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.PlayOneShotSound, 48);
        packet.Write(fileName);
        packet.Write(pos);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendApplyStatusEffect(WorldObject p, ref StatusEffectState state)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.ApplyStatusEffect, 16);
        packet.Write(p.Id);
        packet.Write((byte)state.Type);
        packet.Write((float)(state.Expiration - Time.ElapsedTime));

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendRemoveStatusEffect(WorldObject p, ref StatusEffectState state, bool isRefresh = false)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.RemoveStatusEffect, 16);
        packet.Write(p.Id);
        packet.Write((byte)state.Type);
        packet.Write(isRefresh);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendHealMulti(WorldObject p, int healAmount, HealType type)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.HpRecovery, 32);
        packet.Write(p.Id);
        packet.Write(healAmount);
        packet.Write(p.CombatEntity.GetStat(CharacterStat.Hp));
        packet.Write(p.CombatEntity.GetStat(CharacterStat.MaxHp));
        packet.Write((byte)type);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendHealSingle(Player p, int healAmount, HealType type)
    {
        var packet = NetworkManager.StartPacket(PacketType.HpRecovery, 32);
        packet.Write(p.Character.Id);
        packet.Write(healAmount);
        packet.Write(p.CombatEntity.GetStat(CharacterStat.Hp));
        packet.Write(p.CombatEntity.GetStat(CharacterStat.MaxHp));
        packet.Write((byte)type);

        NetworkManager.SendMessage(packet, p.Connection);
    }


    public static void SendHealMultiAutoVis(WorldObject p, int healAmount, HealType type)
    {
        var packet = NetworkManager.StartPacket(PacketType.HpRecovery, 32);
        packet.Write(p.Id);
        packet.Write(healAmount);
        packet.Write(p.CombatEntity.GetStat(CharacterStat.Hp));
        packet.Write(p.CombatEntity.GetStat(CharacterStat.MaxHp));
        packet.Write((byte)type);

        p.Map?.AddVisiblePlayersAsPacketRecipients(p);
        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }


    public static void ChangeSpValue(Player p, int sp, int maxSp)
    {
        var packet = NetworkManager.StartPacket(PacketType.ChangeSpValue, 8);
        packet.Write(sp);
        packet.Write(maxSp);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendImprovedRecoveryValue(Player p, int hpGain, int spGain)
    {
        var packet = NetworkManager.StartPacket(PacketType.ImprovedRecoveryTick, 32);
        packet.Write(p.Character.Id);
        packet.Write((short)hpGain);
        packet.Write((short)spGain);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendChangeActivatedStateAutoVis(WorldObject c)
    {
        if (c.Map == null)
            return;

        StoreRecipients();
        c.Map.AddVisiblePlayersAsPacketRecipients(c);

        var packet = NetworkManager.StartPacket(PacketType.ToggleActivatedState, 48);

        packet.Write(c.Id);
        packet.Write(c.State == CharacterState.Activated);

        NetworkManager.SendMessageMulti(packet, recipients);

        RestoreRecipients();
    }

    public static void SendExpGain(Player p, int exp, int job = 0)
    {
        var packet = NetworkManager.StartPacket(PacketType.GainExp, 8);
        packet.Write(p.GetData(PlayerStat.Experience));
        packet.Write(exp);
        packet.Write(p.GetData(PlayerStat.JobExperience));
        packet.Write(job);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendRequestFailed(Player p, ClientErrorType error)
    {
        var packet = NetworkManager.StartPacket(PacketType.RequestFailed, 8);
        packet.Write((byte)error);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void LevelUp(WorldObject c, int level, int curExp = 0)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.LevelUp, 8);
        packet.Write(c.Id);
        packet.Write((byte)level);
        packet.Write(curExp);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendNpcDialog(Player p, string name, string dialog, bool isBig)
    {
        var packet = NetworkManager.StartPacket(PacketType.NpcInteraction, 256);

        packet.Write((byte)NpcInteractionType.NpcDialog);
        packet.Write(name);
        packet.Write(dialog);
        packet.Write(isBig);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendFocusNpc(Player p, Npc target, bool isFocus)
    {
        var packet = NetworkManager.StartPacket(PacketType.NpcInteraction, 32);

        var obj = target.Entity.Get<WorldObject>();

        packet.Write((byte)NpcInteractionType.NpcFocusNpc);
        packet.Write(obj.Id);
        packet.Write(isFocus);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendNpcOption(Player p, string[] options)
    {
        var packet = NetworkManager.StartPacket(PacketType.NpcInteraction, 256);

        packet.Write((byte)NpcInteractionType.NpcOption);
        packet.Write(options.Length);
        for (var i = 0; i < options.Length; i++)
        {
            packet.Write(options[i]);
        }

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendNpcEndInteraction(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.NpcInteraction, 8);
        packet.Write((byte)NpcInteractionType.NpcEndInteraction);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendNpcOpenRefineDialog(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.NpcInteraction, 8);
        packet.Write((byte)NpcInteractionType.NpcOpenRefineWindow);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>
    /// Opens the enchant handbook on the player's screen.
    /// </summary>
    /// <remarks>
    /// Carries nothing. Everything the guide shows - the recipes, the odds, where a
    /// material drops - the client already has or can work out, so this is only the shove
    /// that opens the window.
    /// </remarks>
    public static void SendNpcOpenEnchantGuide(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.NpcInteraction, 8);
        packet.Write((byte)NpcInteractionType.NpcOpenEnchantGuide);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>Opens the card grinder. Carries nothing; the client already has the bag.</summary>
    public static void SendNpcOpenCardGrinder(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.NpcInteraction, 8);
        packet.Write((byte)NpcInteractionType.NpcOpenCardGrinder);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendNpcOpenShop(Player p, Npc npc, bool canDiscount)
    {
        var packet = NetworkManager.StartPacket(PacketType.OpenShop, 128);
        var count = 0;
        if (npc.ItemsForSale != null)
            count = npc.ItemsForSale.Count;
        //Matches what the shop actually charges. Reading a different one here would show a
        //price the till does not agree with, which is worse than no discount at all.
        var discount = canDiscount ? p.MaxAvailableLevelOfSkill(CharacterSkill.Discount) : 0;

        packet.Write((byte)1); //buy from NPC
        packet.Write((byte)discount);
        packet.Write(count);

        for (var i = 0; i < count; i++)
        {
            var (item, cost) = npc.ItemsForSale![i];
            packet.Write(item);
            packet.Write(cost);
        }

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendVendOpenShop(Player p, Player vendor, string name)
    {
        Debug.Assert(vendor.VendingState != null);
        Debug.Assert(vendor.CartInventory != null);

        var packet = NetworkManager.StartPacket(PacketType.VendingViewStore, 128);
        var count = vendor.VendingState.SellingItems.Count;

        packet.Write(vendor.Character.Id);
        packet.Write(name);
        packet.Write(count);

        foreach (var (bagId, item) in vendor.VendingState.SellingItems)
        {
            var price = vendor.VendingState.SellingItemValues[bagId];

            packet.Write(bagId);
            item.SerializeWithType(packet);
            packet.Write(price);
        }

        NetworkManager.SendMessage(packet, p.Connection);

        //A shop is full of other people's things, so the names behind any forged weapons
        //in it have to come with the page - the viewer has never held them.
        SendForgedNamesFor(p, vendor.VendingState.SellingItems.Values.Select(i => i.UniqueItem.UniqueId));
    }

    public static void SendNpcBeginTrading(Player p, Npc npc, List<NpcTradeItem> set)
    {
        var packet = NetworkManager.StartPacket(PacketType.StartNpcTrade, 128);

        packet.Write((byte)set.Count);

        foreach (var trade in set)
        {
            trade.CombinedItem.SerializeWithType(packet);
            packet.Write(trade.TradeCount);
            packet.Write(trade.ZenyCost);
            packet.Write(trade.ItemRequirements.Count);
            foreach (var (reqId, reqCount) in trade.ItemRequirements)
            {
                packet.Write(reqId);
                packet.Write((short)reqCount);
            }
        }

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendNpcSellToShop(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.OpenShop, 128);
        packet.Write((byte)0); //sell to NPC
        packet.Write(p.MaxLearnedLevelOfSkill(CharacterSkill.Overcharge));

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendNpcStorage(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.OpenStorage, 2048);
        p.StorageInventory.TryWrite(packet, true);

        NetworkManager.SendMessage(packet, p.Connection);
        SendForgedNamesForBag(p, p.StorageInventory);
    }

    public static void SendNpcStorageMoveEvent(Player p, ItemReference item, int bagId, int movedCount, bool moveToStorage)
    {
        var packet = NetworkManager.StartPacket(PacketType.StorageInteraction, 48);
        packet.Write((byte)item.Type);
        packet.Write(bagId);
        packet.Write((short)movedCount);
        item.Serialize(packet);
        packet.Write(p.Inventory?.BagWeight ?? 0);
        packet.Write(p.StorageInventory?.UsedSlots ?? 0);
        packet.Write(moveToStorage);

        NetworkManager.SendMessage(packet, p.Connection);
        SendForgedNameForItem(p, ref item);
    }

    public static void SendNpcShowSprite(Player p, string spriteName, int pos)
    {
        var packet = NetworkManager.StartPacket(PacketType.NpcInteraction, 8);
        packet.Write((byte)NpcInteractionType.NpcShowSprite);
        packet.Write(spriteName);
        packet.Write((byte)pos);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendAdminHideStatus(Player p, bool isHidden)
    {
        var packet = NetworkManager.StartPacket(PacketType.AdminHideCharacter, 8);
        packet.Write(isHidden);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>
    /// The player's own guild, its roster, and anyone waiting to be let in.
    ///
    /// A member's job and level are whatever was last seen of them: membership survives
    /// logout and a character's job and level live inside a serialized blob rather than in
    /// columns a query can reach, so an online member is read live and an offline one is
    /// read from what the guild remembers. A member nobody has seen since the server came
    /// up is sent as unknown, which the window shows as a dash rather than as level zero.
    /// </summary>
    /// <summary>One line every member should see, in the colour of good news.</summary>
    public static void SendGuildAnnouncement(Player p, string text)
    {
        var packet = NetworkManager.StartPacket(PacketType.GuildData, 128);
        packet.Write((byte)GuildDataType.Announcement);
        packet.Write(text);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>
    /// One line of guild chat to everyone gathered as recipients, with who said it.
    /// </summary>
    /// <remarks>
    /// Carries the speaker's entity id as well as their name, so a client that can see
    /// them floats the line over their head the way a party line is floated; a client on
    /// another map will not find the id and only writes the line in its log.
    /// </remarks>
    public static void SendGuildChatMulti(Player speaker, string text)
    {
        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.GuildData, 364);
        packet.Write((byte)GuildDataType.Chat);
        packet.Write(speaker.Character.Id);
        packet.Write(speaker.Name);
        packet.Write(text);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void SendGuildData(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.GuildData, 1024);
        packet.Write((byte)GuildDataType.MyGuild);

        //How long before this character may join a guild again. It belongs to the player
        //rather than to any guild, so it is written before the guild is even looked at and
        //arrives whether there is one to describe or not - which is the case that matters,
        //since the only screen that needs it is the one you see while you have no guild.
        packet.Write(GuildCooldown.SecondsRemaining(p));

        var guild = p.Guild;
        if (guild == null)
        {
            packet.Write(false);
            NetworkManager.SendMessage(packet, p.Connection);
            return;
        }

        packet.Write(true);
        packet.Write(guild.GuildId);
        packet.Write(guild.GuildName);
        packet.Write(p.GuildTitle); //this character's, not the guild's
        packet.Write(guild.EmblemId);
        packet.Write(guild.Level);
        //Stored as a long so a guild running for years cannot overflow it, but sent as an
        //int: neither side of this connection can read or write a 64 bit number, and the
        //totals in play here are five figures. Clamped rather than cast, so the day that
        //stops being true the number shown is wrong by being too small, not by wrapping
        //round to negative.
        packet.Write((int)Math.Min(guild.Contribution, int.MaxValue));
        packet.Write((int)Math.Min(guild.ContributionToNextLevel, int.MaxValue));
        packet.Write(guild.SkillPoints);
        packet.Write(GuildDonation.RemainingToday(p));

        //Every skill, in enum order, whether learned or not. Sending the whole list rather
        //than only what was learned means the client never has to know which numbers were
        //left out, and adding a skill later changes the count on both sides at once.
        packet.Write((byte)GuildSkills.All.Length);
        foreach (var info in GuildSkills.All)
        {
            packet.Write((byte)info.Skill);
            packet.Write((byte)guild.SkillLevel(info.Skill));
            packet.Write((byte)info.MaxLevel);
            packet.Write(info.Name);
        }

        packet.Write(guild.IsLeader(p));
        packet.Write(Guild.MaxMembers);

        packet.Write((short)guild.Members.Count);
        foreach (var member in guild.Members)
        {
            var online = World.Instance.TryFindPlayerByName(member.Name, out var entity);
            if (online)
            {
                //seen now, so write it down for after they log out
                var other = entity.Get<Player>();
                member.Job = other.GetData(PlayerStat.Job);
                member.Level = other.CharacterLevel;
            }

            packet.Write(member.Name);
            packet.Write(online);
            packet.Write(member.CharacterId == guild.LeaderId);
            packet.Write((short)member.Job);
            packet.Write((short)member.Level);
        }

        //only the leader is shown the queue, since only the leader can answer it
        var requests = guild.IsLeader(p) ? guild.JoinRequests.Count : 0;
        packet.Write((short)requests);
        for (var i = 0; i < requests; i++)
            packet.Write(guild.JoinRequests[i].Name);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>
    /// Every guild that could be asked to join, with how full it is.
    /// </summary>
    public static void SendGuildList(Player p, List<Guild> guilds)
    {
        var packet = NetworkManager.StartPacket(PacketType.GuildData, 2048);
        packet.Write((byte)GuildDataType.GuildList);
        packet.Write(Guild.MaxMembers);

        packet.Write((short)guilds.Count);
        foreach (var guild in guilds)
        {
            packet.Write(guild.GuildId);
            packet.Write(guild.GuildName);
            packet.Write((short)guild.Members.Count);
            packet.Write(guild.HasJoinRequest(p.Id));
        }

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendUpdateZeny(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.UpdateZeny, 8);
        packet.Write(p.GetZeny());

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void DropItemMulti(GroundItem item, bool isNewDrop)
    {
        var packet = NetworkManager.StartPacket(PacketType.DropItem, 88);
        item.Serialize(packet);
        packet.Write(isNewDrop);

        NetworkManager.SendMessageMulti(packet, recipients);

        //A forged weapon on the floor should still say who made it. Goes to the same
        //people the drop did, and costs nothing at all for the drops nobody forged.
        if (item.Type == ItemType.UniqueItem)
            SendForgedNameMulti(item.UniqueItem.UniqueId);
    }

    public static void RevealDropItemForPlayer(GroundItem item, bool isNewDrop, Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.DropItem, 88);
        item.Serialize(packet);
        packet.Write(isNewDrop);

        NetworkManager.SendMessage(packet, p.Connection);

        if (item.Type == ItemType.UniqueItem)
            SendForgedNameForId(p, item.UniqueItem.UniqueId);
    }

    public static void PickUpOrRemoveItemMulti(WorldObject? pickup, GroundItem item)
    {
        var packet = NetworkManager.StartPacket(PacketType.PickUpItem, 32);
        packet.Write(pickup?.Id ?? -1);
        packet.Write(item.Id);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void RemoveDropItemForSinglePlayer(GroundItem item, Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.PickUpItem, 32);
        packet.Write(-1);
        packet.Write(item.Id);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    //alternate version to send to clean up an item that should not be visible to the player.
    public static void RemoveDropItemForSinglePlayerByGroundId(int itemId, Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.PickUpItem, 32);
        packet.Write(-1);
        packet.Write(itemId);

        NetworkManager.SendMessageMulti(packet, recipients);
    }

    public static void AddItemToInventory(Player p, ItemReference item, int bagId, int change)
    {
        var packet = NetworkManager.StartPacket(PacketType.AddOrRemoveInventoryItem, 48);
        packet.Write(true); //isAdd
        packet.Write((byte)item.Type);
        packet.Write(bagId);
        packet.Write((short)change);
        packet.Write(p.Inventory?.BagWeight ?? 0);
        item.Serialize(packet);

        NetworkManager.SendMessage(packet, p.Connection);

        //A forged weapon can arrive one at a time - made, picked up, traded for - and the
        //name has to be there before anything draws it.
        SendForgedNameForItem(p, ref item);
    }

    public static void RemoveItemFromInventory(Player p, int bagId, int change, bool notifyUser = false)
    {
        var packet = NetworkManager.StartPacket(PacketType.AddOrRemoveInventoryItem, 24);
        packet.Write(false); //isAdd
        packet.Write(bagId);
        packet.Write((short)change);
        packet.Write(p.Inventory?.BagWeight ?? 0);
        packet.Write(notifyUser);


        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void MoveItemIntoOrOutOfCart(Player p, CartInteractionType moveType, ItemReference item, int bagId, int change)
    {
        var packet = NetworkManager.StartPacket(PacketType.CartInventoryInteraction, 32);
        packet.Write((byte)moveType);
        packet.Write(bagId);
        item.SerializeWithType(packet);
        packet.Write((short)change);
        packet.Write(p.CartInventory?.BagWeight ?? 0);
        if (moveType == CartInteractionType.InventoryToCart || moveType == CartInteractionType.CartToInventory)
            packet.Write(p.Inventory?.BagWeight ?? 0);
        else
            packet.Write(p.StorageInventory?.BagWeight ?? 0);

        NetworkManager.SendMessage(packet, p.Connection);
        SendForgedNameForItem(p, ref item);
    }

    public static void SendMapMemoLocations(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.MemoMapLocation, 96);

        for (var i = 0; i < 4; i++)
            p.MemoLocations[i].Serialize(packet);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SkillFailed(Player p, SkillValidationResult res)
    {
        var packet = NetworkManager.StartPacket(PacketType.SkillError, 24);
        packet.Write((byte)res);

        NetworkManager.SendMessage(packet, p.Connection);
    }


    public static void ErrorMessage(Player p, string text)
    {
        var packet = NetworkManager.StartPacket(PacketType.ErrorMessage, 64);
        packet.Write(text);

        NetworkManager.SendMessage(packet, p.Connection);
    }


    public static void ErrorMessage(NetworkConnection connection, string text)
    {
        var packet = NetworkManager.StartPacket(PacketType.ErrorMessage, 64);
        packet.Write(text);

        NetworkManager.SendMessage(packet, connection);
    }

    public static void ApplySkillPoint(Player p, CharacterSkill skill)
    {
        var packet = NetworkManager.StartPacket(PacketType.ApplySkillPoint, 32);
        packet.Write((byte)skill);
        packet.Write((byte)p.LearnedSkills[skill]);
        packet.Write(p.GetData(PlayerStat.SkillPoints));

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void ChangePlayerSpecialActionState(Player p, SpecialPlayerActionState state)
    {
        var packet = NetworkManager.StartPacket(PacketType.ChangePlayerSpecialActionState, 16);
        packet.Write((byte)state);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void NotifyNearbyPlayersOfPartyChangeAutoVis(Player p)
    {
        if (p.Character.Map == null)
            return;

        var packet = NetworkManager.StartPacket(PacketType.NotifyPlayerPartyChange, 96);

        p.Character.Map.AddVisiblePlayersAsPacketRecipients(p.Character);

        packet.Write(p.Character.Id);

        if (p.Party == null)
            packet.Write((byte)0);
        else
        {
            packet.Write((byte)1);
            packet.Write(p.Party.PartyId);
            packet.Write(p.Party.PartyName);
            packet.Write(p.Party.PartyOwner == p.Entity);


            //foreach (var m in p.Party.OnlineMembers)
            //{
            //    if(m.TryGet<Player>(out var partyMember))
            //        AddRecipient(partyMember.Connection);
            //}
        }

        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }

    public static void InviteJoinParty(Player p, Player sender, Party party)
    {
        var packet = NetworkManager.StartPacket(PacketType.InvitePartyMember, 256);

        packet.Write(party.PartyId);
        packet.Write(party.PartyName);
        packet.Write(sender.Name);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void AcceptPartyInvite(Player p, bool isLoginMessage = false)
    {
        var party = p.Party;
        if (party == null)
        {
            ServerLogger.LogWarning($"Attempting to SendFullPartyInfo to {p} but they are not currently in a party!");
            return;
        }

        var packet = NetworkManager.StartPacket(PacketType.AcceptPartyInvite, 256);

        packet.Write((byte)(isLoginMessage ? 1 : 0));
        packet.Write(party.PartyId);
        packet.Write(party.PartyName);
        party.SerializePartyInfo(packet);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    private static void AddPartyMembersOutOfViewRange(Player p, Party party)
    {
        foreach (var m in party.OnlineMembers)
        {
            if (m == p.Entity)
                continue;

            if (m.TryGet<Player>(out var partyMember))
            {
                if (partyMember.Character.Map != p.Character.Map || partyMember.Character.Position.DistanceTo(p.Character.Position) > ServerConfig.MaxViewDistance)
                    AddRecipient(partyMember.Connection);
            }
        }
    }

    private static void AddPartyMembers(Player p, Party party, bool addSelf = false, bool addOnlyOnMap = false)
    {
        foreach (var m in party.OnlineMembers)
        {
            if (m == p.Entity && !addSelf)
                continue;

            if (m.TryGet<Player>(out var partyMember))
            {
                if (addOnlyOnMap && p.Character.Map != partyMember.Character.Map)
                    continue;
                AddRecipient(partyMember.Connection);
            }
        }
    }

    /// <summary>
    /// Send hp/sp status to all party members on the current map.
    /// </summary>
    /// <param name="p">Player</param>
    /// <param name="notifyAllMembers">If set to false, only party members out of view distance will be notified.
    /// You'd set this to false if nearby players are notified by another method (damage, regen tick, etc.)</param>
    public static void UpdatePartyMembersOnMapOfHpSpChange(Player p, bool notifyAllMembers = true)
    {
        if (p.Party == null || p.Party.OnlineMembers.Count <= 1)
            return;

        var packet = NetworkManager.StartPacket(PacketType.UpdateParty, 32);
        packet.Write((byte)PartyUpdateType.UpdateHpSp);
        packet.Write(p.PartyMemberId);
        packet.Write(p.GetStat(CharacterStat.Hp));
        packet.Write(p.GetStat(CharacterStat.MaxHp));
        packet.Write(p.GetStat(CharacterStat.Sp));
        packet.Write(p.GetStat(CharacterStat.MaxSp));

        if (notifyAllMembers)
            AddPartyMembers(p, p.Party, false, true);
        else
            AddPartyMembersOutOfViewRange(p, p.Party);

        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }

    public static void UpdatePartyMembersOfMapChange(Player p, string mapName)
    {
        if (p.Party == null || p.Party.OnlineMembers.Count <= 1)
            return;

        var packet = NetworkManager.StartPacket(PacketType.UpdateParty, 32);
        packet.Write((byte)PartyUpdateType.UpdateMap);
        packet.Write(p.PartyMemberId);
        packet.Write(mapName);

        AddPartyMembers(p, p.Party);
        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }

    /// <summary>
    /// Sends one player the whole roster again.
    ///
    /// Kill counts change without anything else about a member changing, and pushing a packet
    /// to the whole party every time a monster falls would be a packet per kill for a number
    /// nobody is looking at unless their party window is open. So the window asks instead,
    /// and this is the answer.
    /// </summary>
    public static void SendFullPartyRefresh(Player p)
    {
        if (p.Party == null)
            return;

        var packet = NetworkManager.StartPacket(PacketType.UpdateParty, 256);
        packet.Write((byte)PartyUpdateType.FullRefresh);
        p.Party.SerializePartyInfo(packet);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>Tells the whole party that the leader changed how experience is split.</summary>
    public static void NotifyPartyOfExpShare(Party party)
    {
        var packet = NetworkManager.StartPacket(PacketType.UpdateParty, 16);
        packet.Write((byte)PartyUpdateType.ChangeExpShare);
        packet.Write((byte)(party.ShareExp ? 1 : 0));

        foreach (var m in party.OnlineMembers)
        {
            if (m.TryGet<Player>(out var partyMember))
                AddRecipient(partyMember.Connection);
        }

        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }

    //--- trading between two players ------------------------------------------------

    /// <summary>Tells somebody that a trade has been asked of them, and by whom.</summary>
    public static void SendTradeRequested(Player p, Player from)
    {
        var packet = NetworkManager.StartPacket(PacketType.TradeUpdate, 64);
        packet.Write((byte)TradeUpdateType.Requested);
        packet.Write(from.Name);
        packet.Write(from.Character.Id);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>Both sides are at the table. Each is told who the other is.</summary>
    public static void SendTradeStarted(Player p, Player partner)
    {
        var packet = NetworkManager.StartPacket(PacketType.TradeUpdate, 64);
        packet.Write((byte)TradeUpdateType.Started);
        packet.Write(partner.Name);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>
    /// One side's offer, in full, to one player.
    ///
    /// Sent whole rather than as a change to what was there, because a trade is the one
    /// place where showing something that is not what is actually being offered is the
    /// entire problem. Both sides get both offers, so what each is looking at came from the
    /// same source rather than from their own copy of what they thought they had put down.
    /// </summary>
    public static void SendTradeOffer(Player to, TradeSession trade, Player owner)
    {
        var offer = trade.OfferOf(owner);
        var bag = owner.Inventory;

        var packet = NetworkManager.StartPacket(PacketType.TradeUpdate, 256);
        packet.Write((byte)TradeUpdateType.Offer);
        packet.Write((byte)(owner == to ? 1 : 0));
        packet.Write(offer.Zeny);

        //counted first so the reader knows how many to take, and counted over what is
        //actually still in the bag rather than over what the offer remembers
        var sendable = new List<(int BagId, ItemReference Item)>();
        foreach (var (bagId, count) in offer.Items)
        {
            if (bag == null || !bag.GetItem(bagId, out var item))
                continue;

            item.Count = count;
            sendable.Add((bagId, item));
        }

        packet.Write(sendable.Count);
        foreach (var (bagId, item) in sendable)
        {
            packet.Write(bagId);
            item.SerializeWithType(packet);
        }

        NetworkManager.SendMessage(packet, to.Connection);

        //The other side has never held these, so the smiths behind them go across too.
        //Sent to both sides rather than only the stranger, since it costs nothing and the
        //owner's own copy of the window reads from the same table.
        SendForgedNamesFor(to, sendable.Select(e => e.Item.UniqueItem.UniqueId));
    }

    /// <summary>Sends both offers to both sides, which is every case that changes one.</summary>
    public static void SendTradeOffers(TradeSession trade)
    {
        SendTradeOffer(trade.A, trade, trade.A);
        SendTradeOffer(trade.A, trade, trade.B);
        SendTradeOffer(trade.B, trade, trade.A);
        SendTradeOffer(trade.B, trade, trade.B);
    }

    /// <summary>Who has agreed so far, from each side's own point of view.</summary>
    public static void SendTradeLockState(TradeSession trade)
    {
        SendTradeLockState(trade.A, trade);
        SendTradeLockState(trade.B, trade);
    }

    /// <summary>
    /// Both steps, not just the first.
    ///
    /// A window that only knows who has locked cannot tell "press confirm" from "you have
    /// pressed it, they have not" - the two look identical from the outside and the second
    /// one is where a player sits waiting, pressing a button that already did its job.
    /// </summary>
    private static void SendTradeLockState(Player p, TradeSession trade)
    {
        var mine = trade.OfferOf(p);
        var theirs = trade.OfferOf(trade.Other(p));

        var packet = NetworkManager.StartPacket(PacketType.TradeUpdate, 16);
        packet.Write((byte)TradeUpdateType.LockChanged);
        packet.Write((byte)(mine.Locked ? 1 : 0));
        packet.Write((byte)(theirs.Locked ? 1 : 0));
        packet.Write((byte)(mine.Confirmed ? 1 : 0));
        packet.Write((byte)(theirs.Confirmed ? 1 : 0));

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void SendTradeCompleted(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.TradeUpdate, 8);
        packet.Write((byte)TradeUpdateType.Completed);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    /// <summary>Says it is off, and why, rather than leaving a window that stopped working.</summary>
    public static void SendTradeCancelled(Player p, string reason)
    {
        var packet = NetworkManager.StartPacket(PacketType.TradeUpdate, 128);
        packet.Write((byte)TradeUpdateType.Cancelled);
        packet.Write(reason);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    //notify party members of a party composition change
    public static void NotifyPartyOfChange(Party party, int memberId, PartyUpdateType type)
    {
        if (type == PartyUpdateType.UpdateHpSp || type == PartyUpdateType.UpdateMap
                                               || type == PartyUpdateType.FullRefresh
                                               || type == PartyUpdateType.ChangeExpShare)
            throw new Exception($"You shouldn't use NotifyPartyOfChange for party updates of type {type}, use specific handlers for them.");

        var packet = NetworkManager.StartPacket(PacketType.UpdateParty, 96);

        packet.Write((byte)type);
        var includeSelf = false;

        switch (type)
        {
            case PartyUpdateType.LogOut:
            case PartyUpdateType.LogIn:
            case PartyUpdateType.UpdatePlayer:
            case PartyUpdateType.AddPlayer:
                if (!party.PartyMemberInfo.TryGetValue(memberId, out var info))
                {
                    ServerLogger.LogWarning($"Calling NotifyPartyOfChange, but the member id {memberId} doesn't reference anyone currently in party.");
                    return;
                }

                party.SerializePartyMemberInfo(packet, info, memberId);
                break;
            case PartyUpdateType.ChangeLeader:
            case PartyUpdateType.RemovePlayer:
                includeSelf = true;
                packet.Write(memberId);
                break;
            case PartyUpdateType.LeaveParty:
            case PartyUpdateType.DisbandParty:
            default:
                includeSelf = true;
                break;
        }

        foreach (var m in party.OnlineMembers)
        {
            if (m.TryGet<Player>(out var partyMember))
            {
                if (includeSelf || partyMember.PartyMemberId != memberId) //don't notify the added player, they'll get an AcceptParty packet
                    AddRecipient(partyMember.Connection);
            }
        }

        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }

    public static void UpdatePlayerFollowerStateAutoVis(Player p)
    {
        if (p.Character.Map == null)
            return;

        p.Character.Map.AddVisiblePlayersAsPacketRecipients(p.Character);

        if (!HasRecipients())
            return;

        var packet = NetworkManager.StartPacket(PacketType.ChangeFollower, 12);

        packet.Write(p.Character.Id);
        packet.Write((byte)p.PlayerFollower);

        NetworkManager.SendMessageMulti(packet, recipients);
        ClearRecipients();
    }

    public static void VendingNotifyOfSale(Player p, int bagId, int change)
    {
        if (p.VendingState == null)
        {
            ServerLogger.LogWarning($"Call to CommandBuilder.UpdateVendingState failed for player {p.Name} as they do not have a VendingState!");
            return;
        }

        var packet = NetworkManager.StartPacket(PacketType.VendingNotifyOfSale);

        packet.Write(bagId);
        packet.Write(change);

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void VendingStart(Player p, string vendName)
    {
        if (p.VendingState == null)
        {
            ServerLogger.LogWarning($"Call to CommandBuilder.VendingStart failed for player {p.Name} as they do not have a VendingState!");
            return;
        }

        var packet = NetworkManager.StartPacket(PacketType.VendingStart);

        packet.Write(vendName);
        packet.Write(p.VendingState.SellingItems.Count);
        foreach (var (id, c) in p.VendingState.SellingItems)
        {
            var price = p.VendingState.SellingItemValues[id];
            packet.Write(id); //only need to send the bagId, not the full serialized item, as they have the items in their cart still
            packet.Write(c.Count);
            packet.Write(price);
        }

        NetworkManager.SendMessage(packet, p.Connection);
    }

    public static void VendingEnd(Player p)
    {
        var packet = NetworkManager.StartPacket(PacketType.VendingStop);
        NetworkManager.SendMessage(packet, p.Connection);
    }
}