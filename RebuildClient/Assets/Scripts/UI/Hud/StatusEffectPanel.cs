using System;
using System.Collections.Generic;
using Assets.Scripts.Network;
using Assets.Scripts.Sprites;
using Assets.Scripts.UI.Guild;
using Assets.Scripts.Utility;
using RebuildSharedData.Enum;
using UnityEngine;

namespace Assets.Scripts.UI.Hud
{
    public class StatusEffectPanel : MonoBehaviour
    {
        public GameObject StatusEffectPrefab;
        public Transform BuffPanel;
        public Transform DebuffPanel;

        [NonSerialized] private List<StatusEffectEntry> StatusEffects = new();
        private Dictionary<CharacterStatusEffect, StatusEffectEntry> StatusEffectLookup = new();

        private RectTransform mainRect;
        private RectTransform buffRect;

        private int buffCount;
        private int debuffCount;

        public static StatusEffectPanel Instance;

        /// <summary>
        /// The blue the guild buff is tinted, and only ever applied to a picture borrowed
        /// from another status - a guild wearing its own emblem keeps its own colours.
        /// Kept light so it shifts the hue without dulling the art it multiplies against.
        /// </summary>
        private static readonly Color GuildBuffTint = new Color(0.62f, 0.82f, 1f);

        void Awake()
        {
            Instance = this;
            StatusEffectPrefab.SetActive(false);
        }

        public void AddStatusEffect(CharacterStatusEffect status, float time)
        {
            var expiration = Time.timeSinceLevelLoad + time;
            if (StatusEffectLookup.TryGetValue(status, out var existing))
            {
                existing.Expiration = expiration;
                return;
            }

            var icon = ClientDataLoader.Instance.GetIconAtlasSprite($"status_{status}");

            //The guild buff wears the guild's own emblem where it has one, and that is not
            //only decoration: status_GuildBuff.png exists solely because somebody ran the
            //icon importer in the editor, and an effect with no icon is dropped below
            //without a word. A player with a guild skill would see nothing at all and
            //conclude the skill never took. Blessing's icon is the last resort - it ships
            //with every other status effect, so there is always something to show.
            var borrowedIcon = false;
            if (status == CharacterStatusEffect.GuildBuff)
            {
                var mark = GuildEmblems.Sprite(GuildState.EmblemId);
                if (mark != null)
                    icon = mark;
                //Two plain checks rather than a null-coalesce: these are UnityEngine
                //objects, and ?? tests the reference where == asks Unity whether the thing
                //is still alive, which is the question that matters for an atlas sprite.
                if (icon == null)
                    icon = ClientDataLoader.Instance.GetIconAtlasSprite("status_Blessing");
                if (icon == null)
                    icon = ClientDataLoader.Instance.GetIconAtlasSprite("status_Gloria");

                //Asked of the emblem number rather than of the sprite above, because a boss
                //emblem has no sprite yet at this point - its picture is still being read
                //off disk - and tinting on that basis would leave the art stained blue when
                //it does arrive.
                borrowedIcon = !GuildEmblems.IsValid(GuildState.EmblemId);
            }

            if (icon == null)
            {
#if UNITY_EDITOR
                Debug.Log($"Status effect {status} could not find icon, will not display entry.");
#endif
                return;
            }

            var statusInfo = ClientDataLoader.Instance.GetStatusEffect((int)status);
            //A status the client has no entry for still belongs on the bar. Reading Type
            //off a null here would take down the whole panel over one missing row.
            var isBuff = statusInfo == null || statusInfo.Type == "Buff";
            var target = isBuff ? BuffPanel : DebuffPanel;

            if (isBuff)
                buffCount++;
            else
                debuffCount++;

            var go = Instantiate(StatusEffectPrefab);
            go.transform.SetParent(target);
            go.SetActive(true);
            go.transform.localScale = Vector3.one;
            var newEffect = go.GetComponent<StatusEffectEntry>();
            newEffect.StatusEffect = status;
            newEffect.Expiration = expiration;
            newEffect.UpdateTime();
            newEffect.StatusIcon.sprite = icon;
            if (borrowedIcon)
                newEffect.StatusIcon.color = GuildBuffTint;
            newEffect.IsBuff = isBuff;
            if (statusInfo != null && statusInfo.CanDisable)
                newEffect.CanCancel = true;

            //Only for a boss, and only after the sprite above is already in place: boss art
            //is loaded from addressables rather than sitting in the atlas, so it arrives
            //later and the icon set above is what fills the gap. Anything else has already
            //been handled, and calling this for an emblem number this client does not know
            //would switch the picture off rather than leave the fallback showing.
            if (status == CharacterStatusEffect.GuildBuff
                && GuildEmblems.IsBossEmblem(GuildState.EmblemId))
                GuildEmblems.LoadInto(newEffect.StatusIcon, GuildState.EmblemId);

            StatusEffects.Add(newEffect);
            StatusEffectLookup.Add(status, newEffect);

            BuffPanel.gameObject.SetActive(BuffPanel.childCount > 0);
            DebuffPanel.gameObject.SetActive(DebuffPanel.childCount > 0);
        }

        public void RemoveStatusEffect(CharacterStatusEffect status)
        {
            if (!StatusEffectLookup.TryGetValue(status, out var existing))
                return;

            StatusEffectLookup.Remove(status);
            StatusEffects.Remove(existing);
            Destroy(existing.gameObject);

            var statusInfo = ClientDataLoader.Instance.GetStatusEffect((int)status);
            //counted the same way it was counted on the way in, missing row and all
            if (statusInfo == null || statusInfo.Type == "Buff")
                buffCount--;
            else
                debuffCount--;

            BuffPanel.gameObject.SetActive(BuffPanel.childCount > 0);
            DebuffPanel.gameObject.SetActive(DebuffPanel.childCount > 0);
        }

        private void LateUpdate()
        {
            if (mainRect == null)
            {
                mainRect = transform as RectTransform;
                buffRect = BuffPanel as RectTransform;
            }

            if (buffRect.childCount == 0)
                return;

            var first = buffRect.GetChild(0) as RectTransform;
            var fitCount = buffRect.sizeDelta.y / (first.sizeDelta.y + 15);

            var c = 0;

            foreach (var status in StatusEffects)
            {
                if (status.IsBuff)
                    c++;
                status.gameObject.SetActive(c < fitCount);
            }
        }

        void Update()
        {
            foreach (var e in StatusEffects)
                e.UpdateTime();
        }
    }
}