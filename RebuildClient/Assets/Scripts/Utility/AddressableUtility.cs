using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;
using UnityEngine.ResourceManagement.ResourceLocations;

namespace Assets.Scripts.Utility
{
	public static class AddressableUtility
	{
		private static readonly HashSet<string> ReportedMissingKeys = new HashSet<string>();

		/// <summary>
		/// Whether the catalog has anything at all under this key.
		/// </summary>
		/// <remarks>
		/// Every load below has to ask this first. Addressables answers a key it has never
		/// heard of by throwing InvalidKeyException out of LoadAssetAsync rather than handing
		/// back a failed handle, and a throw out of a synchronous call takes the caller's
		/// whole method with it. That has cost this project three separate bugs already: a
		/// hunter's trap with no model killed the rest of the entity setup, a map with no
		/// minimap killed the minimap coroutine, and a map whose bgm was never copied out of
		/// the client killed the scene change halfway through - leaving the game on a black
		/// screen reading Loading forever, with an error naming an mp3 as the only clue.
		///
		/// Half the folders these keys point into are gitignored and built on the player's own
		/// machine out of their GRF, so an asset that is simply not there yet is the ordinary
		/// case here, not a broken install.
		/// </remarks>
		public static bool Exists<T>(string key)
		{
			if (string.IsNullOrWhiteSpace(key))
				return false;

			foreach (var locator in Addressables.ResourceLocators)
			{
				if (locator.Locate(key, typeof(T), out IList<IResourceLocation> locations) && locations != null && locations.Count > 0)
					return true;
			}

			return false;
		}

		/// <summary>Says a key is missing, once per key, so a per-frame loader can't flood the console.</summary>
		private static void ReportMissing<T>(string key)
		{
			if (!ReportedMissingKeys.Add(key))
				return;

			Debug.Log($"Nothing is registered under {key}, so the {typeof(T).Name} it would have loaded is skipped.");
		}

		public static void LoadRoSpriteData(GameObject owner, string spritePath, Action<RoSpriteData> onComplete)
        {
	        if (string.IsNullOrWhiteSpace(spritePath))
	        {
		        //Debug.LogError($"Attempting to load RoSpriteData but the spritePath was empty!");
		        return;
	        }

	        if (!Exists<RoSpriteData>(spritePath))
	        {
		        ReportMissing<RoSpriteData>(spritePath);
		        return;
	        }

	        var load = Addressables.LoadAssetAsync<RoSpriteData>(spritePath);
			load.Completed += handle =>
			{
				if(handle.Status != AsyncOperationStatus.Succeeded)
					Debug.LogError("Could not load sprite name " + spritePath);
				if (owner != null)
					onComplete(handle.Result);
			};
        }
		
		public static void LoadSprite(GameObject owner, string spritePath, Action<Sprite> onComplete)
		{
            if (string.IsNullOrWhiteSpace(spritePath))
                throw new Exception($"Attempting to load Sprite but the spritePath was empty!");

            if (!Exists<Sprite>(spritePath))
            {
	            ReportMissing<Sprite>(spritePath);
	            return;
            }

            Addressables.LoadAssetAsync<Sprite>(spritePath).Completed += handle =>
			{
                if (handle.Status != AsyncOperationStatus.Succeeded)
                    Debug.LogError("Could not load sprite name " + spritePath);
				if (owner != null)
					onComplete(handle.Result);
			};
		}
		
		public static void LoadSprite(GameObject owner, string spritePath, Action<Sprite> onComplete, Action onError)
		{
			if (string.IsNullOrWhiteSpace(spritePath))
				throw new Exception($"Attempting to load Sprite but the spritePath was empty!");

			if (!Exists<Sprite>(spritePath))
			{
				ReportMissing<Sprite>(spritePath);
				onError();
				return;
			}

			Addressables.LoadAssetAsync<Sprite>(spritePath).Completed += handle =>
			{
				if (handle.Status != AsyncOperationStatus.Succeeded)
				{
					Debug.LogError("Could not load sprite name " + spritePath);
					onError();
				}

				if (owner != null)
					onComplete(handle.Result);
			};
		}


		/// <summary>
		/// Starts a load, or hands back an invalid handle when the key is not in the catalog.
		/// Callers that keep the handle must ask IsValid() before reading Status off it.
		/// </summary>
		public static AsyncOperationHandle<T> Load<T>(GameObject owner, string fileName, Action<T> onComplete)
		{
            if (string.IsNullOrWhiteSpace(fileName))
                throw new Exception($"Attempting to load type {typeof(T)} but the fileName was empty!");

            if (!Exists<T>(fileName))
            {
	            ReportMissing<T>(fileName);
	            return default;
            }

            var asyncOp = Addressables.LoadAssetAsync<T>(fileName);
            asyncOp.Completed += handle =>
			{
				if (owner != null)
					onComplete(handle.Result);
			};

            return asyncOp;
		}
	}
}
