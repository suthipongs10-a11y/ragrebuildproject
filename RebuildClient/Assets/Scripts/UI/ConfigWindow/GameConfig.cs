using System;
using System.IO;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.UI.Mobile;
using UnityEngine;
using File = System.IO.File;

namespace Assets.Scripts.UI.ConfigWindow
{
    public static class GameConfig
    {
        public static GameConfigData Data;

        /// <summary>How much smaller the interface is drawn on a phone than the slider says.</summary>
        /// <remarks>
        /// The slider is one number for every machine, and the number that reads well on a
        /// monitor is too big on a screen a quarter of the width - windows come up wider than
        /// the screen and the top of a tall one is simply off it. Rather than ask every player
        /// to find the slider and drag it before they can read anything, a phone takes a
        /// quarter off the top. The slider still works from there, with its whole range, so
        /// anyone who wants it bigger or smaller can still say so - it just starts somewhere
        /// that fits.
        /// </remarks>
        private const float PhoneUiScale = 0.75f;

        /// <summary>
        /// The scale the interface is actually drawn at, which is not the setting on the slider.
        /// </summary>
        /// <remarks>
        /// Everything that scales with the interface has to read this and not MasterUIScale:
        /// the canvas, and also the name plates and the tooltip, which divide by the scale to
        /// work out where to sit. Two of them reading different numbers puts every name in the
        /// game a fixed distance above or below the head it belongs to, which is the sort of
        /// bug that looks like a sprite problem.
        /// </remarks>
        public static float UiScale
        {
            get
            {
                InitializeIfNecessary();
                if (Data == null)
                    return 1f;

                return Data.MasterUIScale * (MobileMode.IsActive ? PhoneUiScale : 1f);
            }
        }

        public static int GetVolumeForAudioChannel(ConfigAudioChannel channel) => Data.AudioVolumeLevels[(int)channel];
        public static bool GetMuteStatusForAudioChannel(ConfigAudioChannel channel) => Data.AudioMuteValues[(int)channel];
        public static void SetVolumeForAudioChannel(ConfigAudioChannel channel, int volume) => Data.AudioVolumeLevels[(int)channel] = volume;
        public static void SetMuteStatusForAudioChannel(ConfigAudioChannel channel, bool isMuted) => Data.AudioMuteValues[(int)channel] = isMuted;
        
        private static bool isInitialized;
        private static string configPath => Path.Combine(Application.persistentDataPath, "config.txt");

        public static void InitializeIfNecessary()
        {
            if (isInitialized)
                return;
            
            Data = new GameConfigData();
            Data.InitDefaultValues();

            if (File.Exists(configPath))
            {
                try
                {
                    Debug.Log($"Loading config from path {configPath}");
                    string configText = File.ReadAllText(configPath);
                    JsonUtility.FromJsonOverwrite(configText, Data);
                }
                catch (Exception)
                {
                    Debug.LogError($"Could not load config file from {configPath}, using default values instead.");

                }
            }
            else
            {
                Data = new GameConfigData();
                Data.InitDefaultValues();
            }


            isInitialized = true;
        }

        public static void SaveConfig()
        {
            UiManager.Instance.SyncFloatingBoxPositionsWithSaveData();
            var charName = PlayerState.Instance?.PlayerName;
            if(!string.IsNullOrWhiteSpace(charName))
                UiManager.Instance.SkillHotbar.SaveHotBarData(Data.GetHotBarDataForCharacter(charName));
            
            Debug.Log($"Saving game configuration to {configPath}");
            if (!isInitialized)
            {
                Debug.LogError($"Cannot save game config as it is not yet initialized.");
                return;
            }
            
            var text = JsonUtility.ToJson(Data);
            File.WriteAllText(configPath, text);
        }
        
    }
}