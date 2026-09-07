using System;
using System.Collections.Generic;
using JetBrains.Annotations;
using UnityEngine;

namespace Assets.Scripts.UI.ConfigWindow
{
    public enum ConfigAudioChannel
    {
        Master,
        Music,
        Effects,
        Environment
    }

    [Serializable]
    public class HotBarSaveData
    {
        public DragItemType Type;
        public int ItemId;
        public int ItemCount;
        public byte[] UniqueItem;
    }
    
    [Serializable]
    public class GameConfigData : ISerializationCallbackReceiver
    {
        //settings
        public int[] WindowSizes;
        public Vector2[] WindowPositions;
        //audio
        public int[] AudioVolumeLevels;
        public bool[] AudioMuteValues;
        //skills
        /// <summary>
        /// 0 auto, 1 always the phone layout, 2 never it. See MobileMode, which is the only
        /// thing that should read this.
        /// </summary>
        public int MobileUiMode = 0;

        /// <summary>
        /// Where the player dragged each hotbar slot, as "id:x:y", one entry per slot moved.
        /// </summary>
        /// <remarks>
        /// A list of strings rather than a list of a small struct, because this file is
        /// serialized by Unity's own json writer and every shape it cannot handle comes back
        /// as a silently empty field. A string it can always handle, and a slot whose entry
        /// will not parse simply goes back to the column it came from.
        ///
        /// Only slots that were actually moved appear. Everything else is laid out by
        /// MobileHudLayout as it always was, so a player who never drags anything has an
        /// empty list here and the default bar.
        /// </remarks>
        public List<string> MobileSkillSlotPositions = new();

        /// <summary>Whether the character readout is folded away, on a phone.</summary>
        public bool MobileHideReadout = false;

        public bool AutoLockSkillWindow = false;
        public bool ShowAllSkillsInSkillWindow = false;
        //character overlay
        public float DamageNumberSize = 0.85f;
        public float DamageSpacingSize = 0.7f;
        public bool ShowExpGainOnKill = true;
        public bool ShowMonsterHpBars = true;
        public bool AutoHideFullHPBars = false;
        public bool ScalePlayerDisplayWithZoom = true;
        public bool ShowLevelsInOverlay = true;
        //ui
        public float MasterUIScale = 0.75f;

        public bool ShowBaseExpValue = true;
        public bool ShowBaseExpPercent = true;
        public bool ShowJobExpValue = true;
        public bool ShowJobExpPercent = true;
        public bool ShowExpGainInChat = false;

        //visuals
        public bool UseSmoothPixel = true;

        public bool UseUnfilteredSprites = false;
        public bool UseSpriteBasedDamageNumbers = false;
        public bool AllowTabToShowWalkTable = false;
        public bool HideShoutChat = false;
        
        public bool EnableXRay = false;

        //graphics
        /// <summary>
        /// Which of the presets is selected, or Custom once something is changed by hand.
        /// Unset on a new install so the first launch can guess from the screen it is on -
        /// see GraphicsQuality.ApplySaved.
        /// </summary>
        public int GraphicsPreset = -1;

        /// <summary>
        /// What fraction of the screen's real pixels the world is drawn at, 0.5 to 1. The
        /// interface is drawn at full size either way, so this costs far less than it looks
        /// like it should and is the single biggest thing on a phone.
        /// </summary>
        public float RenderScale = 1f;

        public bool EnableShadows = true;
        public bool EnableHdr = true;
        public bool EnableWaterReflection = true;
        public bool EnableMapEffects = true;
        public bool ShowOtherPlayers = true;
        public bool ThrottleDistantAnimation = false;

        /// <summary>Drops every texture to half size, which is the one setting that gives memory back.</summary>
        public bool HalfTextureMemory = false;

        /// <summary>0 for no cap, otherwise the frames per second to aim for.</summary>
        public int FrameRateCap = 0;

        public bool ShowFpsCounter = false;

        //game
        public bool EnableWASDControls = false;

        //storage
        public Vector2 StoragePosition = Vector2.zero;
        public int LastStorageTab = 0;
        public int LastPlayedVersion = 0;
        public string LastViewedPatchNotes = "";
        public int LastUsedCharacterSlot = 0;

        //this is stupid but unity won't serialize dictionaries so we gotta do it ourselves
        public List<string> CharacterNames = new();
        public List<HotBarSaveData> AllHotBarData = new();
        
        [NonSerialized] public Dictionary<string, HotBarSaveData[]> CharacterHotBarData = new();

        //user
        [CanBeNull] public string SavedLoginToken;

        public HotBarSaveData[] GetHotBarDataForCharacter(string name)
        {
            if (CharacterHotBarData.TryGetValue(name, out var data))
                return data;

            var hotBarData = new HotBarSaveData[30];
            CharacterHotBarData.Add(name, hotBarData);

            return hotBarData;
        }

        public void InitDefaultValues()
        {
            AudioVolumeLevels = new int[4];
            AudioMuteValues = new bool[4];
            // HotBarSaveData = new HotBarSaveData[30];

            AudioVolumeLevels[(int)ConfigAudioChannel.Master] = 25;
            AudioVolumeLevels[(int)ConfigAudioChannel.Music] = 70;
            AudioVolumeLevels[(int)ConfigAudioChannel.Effects] = 50;
            AudioVolumeLevels[(int)ConfigAudioChannel.Environment] = 50;

            for (var i = 0; i < 4; i++)
                AudioMuteValues[i] = false;
        }

        public void OnBeforeSerialize()
        {
            CharacterNames.Clear();
            AllHotBarData.Clear();
            
            foreach (var (name, hotbar) in CharacterHotBarData)
            {
                CharacterNames.Add(name);
                foreach(var h in hotbar)
                    AllHotBarData.Add(h);
            }

        }

        public void OnAfterDeserialize()
        {

            for (var j = 0; j < CharacterNames.Count; j++)
            {
                var name = CharacterNames[j];
                if (!CharacterHotBarData.TryGetValue(name, out var hotBar))
                {
                    hotBar = new HotBarSaveData[30];
                    CharacterHotBarData.Add(name, hotBar);
                }

                for (var i = 0; i < 30; i++)
                    hotBar[i] = AllHotBarData[j * 30 + i];
            }
        }
    }
}