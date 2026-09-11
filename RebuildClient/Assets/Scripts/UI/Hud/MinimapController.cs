using System.Collections;
using System.Collections.Generic;
using Assets.Scripts.PlayerControl;
using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.UI;

namespace Assets.Scripts.UI.Hud
{
    public class MinimapController : MonoBehaviour
    {
        public GameObject ContentContainer;
        public GameObject Viewport;

        public Image MapImage;
        public Material OverworldMaterial;
        public Material DungeonMaterial;
        public Sprite PlayerIcon;
        public Sprite OtherPlayerIcon;
        public Sprite PartyMemberIcon;
        public Sprite BossIcon;
        public Sprite MvpIcon;
        public Sprite PortalIcon;
        public Sprite WarpNpcIcon;
        public Sprite KafraIcon;
        public Slider ZoomSlider;
    
        private GameObject playerMapIconObject;
        private GameObject bossPresenceIcon;
        private Dictionary<int, MinimapEntityData> mapIcons = new();

        public MapType MapType;

        public float ObjectScaleFactor = 1f;
        public float MinimapPixelsPerTile = 5f;

        public float minScale;
        public float maxScale;

        public float curSize;
        public float lastZoom;

        private float offsetX;
        private float offsetY;
    
        private static MinimapController instance;

        private Coroutine loadCoroutine;

        private Sprite mapSprite;
        public Sprite walkSprite;
    
        private class MinimapEntityData
        {
            public GameObject MapIcon;
            public Vector2Int Position;
            public CharacterDisplayType Type;
        }

   

        public static MinimapController Instance
        {
            get
            {
                if (instance != null)
                    return instance;
                instance = FindObjectOfType<MinimapController>();
                return instance;
            }
        }

        /// <summary>
        /// How many other players the map is currently tracking. Every player on the map
        /// is registered as an important entity by the server, so this is the map's
        /// population less yourself.
        /// </summary>
        public int CountTrackedPlayers()
        {
            if (mapIcons == null)
                return 0;

            var count = 0;
            foreach (var entry in mapIcons)
            {
                if (entry.Value != null && entry.Value.Type == CharacterDisplayType.Player)
                    count++;
            }

            return count;
        }

        public void RemoveAllEntities()
        {
            if (mapIcons == null) return;
        
            foreach(var icon in mapIcons)
                Destroy(icon.Value.MapIcon);
            mapIcons.Clear();
            RefreshBossPresence();
        }

        public void RemoveEntity(int entityId)
        {
            if (mapIcons == null || !mapIcons.Remove(entityId, out var mapIcon))
                return;

            Destroy(mapIcon.MapIcon);

            if (mapIcon.Type == CharacterDisplayType.Boss || mapIcon.Type == CharacterDisplayType.Mvp)
                RefreshBossPresence();
        }

        /// <summary>
        /// Shows a badge in the corner of the minimap while something worth hunting is still
        /// standing on this map, and takes it away when it is not.
        /// </summary>
        /// <remarks>
        /// Pinned to the viewport rather than to the picture, because the picture scrolls and
        /// scales underneath as the player moves and zooms - a badge parented to it would
        /// drift off the panel. Which is the point: it is the one marker here that carries no
        /// position on purpose.
        /// </remarks>
        private void RefreshBossPresence()
        {
            var wanted = false;
            if (mapIcons != null)
            {
                foreach (var (_, entry) in mapIcons)
                {
                    if (entry.Type != CharacterDisplayType.Boss && entry.Type != CharacterDisplayType.Mvp)
                        continue;
                    wanted = true;
                    break;
                }
            }

            if (!wanted)
            {
                if (bossPresenceIcon != null)
                    bossPresenceIcon.SetActive(false);
                return;
            }

            if (bossPresenceIcon == null)
            {
                var host = Viewport != null ? Viewport : gameObject;

                bossPresenceIcon = new GameObject("BossPresence");
                bossPresenceIcon.transform.SetParent(host.transform, false);

                var img = bossPresenceIcon.AddComponent<Image>();
                img.sprite = MvpIcon != null ? MvpIcon : BossIcon;
                img.raycastTarget = false;
                img.preserveAspect = true;

                //top left of the panel, clear of the zoom slider down the other side
                var rect = (RectTransform)bossPresenceIcon.transform;
                rect.anchorMin = new Vector2(0, 1);
                rect.anchorMax = new Vector2(0, 1);
                rect.pivot = new Vector2(0, 1);
                rect.anchoredPosition = new Vector2(4, -4);
                rect.sizeDelta = new Vector2(16, 16);
            }

            bossPresenceIcon.transform.SetAsLastSibling();

            if (!bossPresenceIcon.activeSelf)
                bossPresenceIcon.SetActive(true);
        }

        /// <summary>
        /// Green for the people you are with, grey-blue for everybody else.
        ///
        /// There is a separate sprite for a party member and there has been all along, but on
        /// a phone-sized minimap two shapes of the same colour at five pixels across are the
        /// same dot. The colour is what carries it at that size, so the sprite is tinted as
        /// well as swapped - the same green the party window puts beside an online name, so
        /// the two pages read as being about the same people.
        /// </summary>
        private static readonly Color PartyMemberTint = new Color(0.235f, 0.784f, 0.310f);

        private void PaintPlayerIcon(Image image, int entityId)
        {
            var state = PlayerState.Instance;
            var inParty = state.IsInParty && state.PartyMemberIdLookup.ContainsKey(entityId);

            image.sprite = inParty ? PartyMemberIcon : OtherPlayerIcon;
            image.color = inParty ? PartyMemberTint : Color.white;
        }

        public void RefreshPartyMembers()
        {
            var state = PlayerState.Instance;

            foreach (var (entityId, mapEntry) in mapIcons)
            {
                if (mapEntry.MapIcon == null || entityId == state.EntityId || mapEntry.Type != CharacterDisplayType.Player)
                    continue;

                PaintPlayerIcon(mapEntry.MapIcon.GetComponent<Image>(), entityId);
            }
        }

        public void SetEntityPosition(int entityId, CharacterDisplayType type, Vector2Int pos)
        {
            if (!mapIcons.TryGetValue(entityId, out var iconData))
            {
                iconData = new MinimapEntityData() { MapIcon = null, Position = pos, Type = type };
                mapIcons.Add(entityId, iconData);
            }

            //Kept up to date even when there is nowhere to draw it yet. The minimap image
            //loads a moment after a warp does, and what it replays once it arrives is this
            //stored position, so a stale one would put everybody where they used to be.
            iconData.Position = pos;
            iconData.Type = type;

            //A boss is tracked but never drawn where it stands. The server reports these map
            //wide rather than by sight, so a marker on the picture was a compass needle
            //pointing at the thing the map is supposed to make you hunt for. What is left is
            //the badge below: it says one is out there, and nothing about where.
            if (type == CharacterDisplayType.Boss || type == CharacterDisplayType.Mvp)
            {
                if (iconData.MapIcon != null)
                {
                    Destroy(iconData.MapIcon);
                    iconData.MapIcon = null;
                }

                RefreshBossPresence();
                return;
            }

            if (!gameObject.activeInHierarchy || MapImage == null || mapSprite == null)
                return;

            var scale = 0.3f;
            if (type == CharacterDisplayType.Boss || type == CharacterDisplayType.Mvp)
                scale = 0.4f;
            //Another player is the one marker you are actually looking for on a crowded
            //map, and at the size the rest of the furniture uses it was a speck.
            if (type == CharacterDisplayType.Player)
                scale = 0.42f;
            if (type == CharacterDisplayType.Portal)
                scale = 0.08f;

            GameObject mapIcon = iconData.MapIcon;

            if (mapIcon == null)
            {
                mapIcon = new GameObject("PlayerIcon");
                mapIcon.transform.SetParent(MapImage.transform, false);


                var img = mapIcon.AddComponent<Image>();
                switch (type)
                {
                    case CharacterDisplayType.Player:
                        PaintPlayerIcon(img, entityId);
                        break;
                    case CharacterDisplayType.Boss: img.sprite = BossIcon; break;
                    case CharacterDisplayType.Mvp: img.sprite = MvpIcon; break;
                    case CharacterDisplayType.Portal: img.sprite = PortalIcon; break;
                    case CharacterDisplayType.WarpNpc: img.sprite = WarpNpcIcon; break;
                    case CharacterDisplayType.Kafra: img.sprite = KafraIcon; break;
                    default: 
                        Debug.Log($"Unknown character display type for minimap icon: {type}");
                        img.sprite = OtherPlayerIcon;
                        break;
                }

                iconData.MapIcon = mapIcon;
            }
        
            var r = mapIcon.GetComponent<RectTransform>();

            r.anchorMin = Vector2.zero;
            r.anchorMax = Vector2.zero;

            var h = mapSprite.texture.height;
            var offset = new Vector3(0.5f, 0.5f, 0);

            r.localPosition = new Vector3(pos.x * MinimapPixelsPerTile / 2f, pos.y * MinimapPixelsPerTile / 2f - h, 0f) + offset;

            //Only the marker moves. Scrolling the map to whatever entity was last reported
            //belongs to SetPlayerPosition and was copied in here by mistake: it meant that
            //every time somebody else took a step, the view slid off you and onto them.

            var s = scale * ObjectScaleFactor * (1 / curSize);
        
            mapIcon.transform.localScale = Vector3.one * s;

            playerMapIconObject?.transform.SetAsLastSibling();
        }

        public void SetPlayerPosition(Vector2Int pos, float angle)
        {
            if (!gameObject.activeInHierarchy || MapImage == null || mapSprite == null)
                return;

            if (playerMapIconObject == null)
            {
                playerMapIconObject = new GameObject("PlayerIcon");
                playerMapIconObject.transform.SetParent(MapImage.transform, false);


                var img = playerMapIconObject.AddComponent<Image>();
                img.sprite = PlayerIcon;

         
                //var w = mapSprite.texture.width;
                //var h = mapSprite.texture.height;
         
            }
            //Debug.Log(pos + " " + new Vector3(pos.x * 10f, pos.y * 10f, 0f));

            var r = playerMapIconObject.GetComponent<RectTransform>();

            r.anchorMin = Vector2.zero;
            r.anchorMax = Vector2.zero;

            var w = mapSprite.texture.width;
            var h = mapSprite.texture.height;
            var offset = new Vector3(0.5f, 0.5f, 0);

            r.localPosition = new Vector3(pos.x * MinimapPixelsPerTile / 2f, pos.y * MinimapPixelsPerTile / 2f - h, 0f) + offset;

            //ScrollRect.horizontalNormalizedPosition = pos.x / (float)w;

            var px = (pos.x * MinimapPixelsPerTile / 2f + offsetX) * curSize;
            var py = ((h - pos.y * MinimapPixelsPerTile / 2f) + offsetY) * curSize;

            var scrollx = px - 125f;
            var scrolly = py - 125f;



            var maxScroll = ((Mathf.Max(w, h) * curSize - 250f));


            scrollx = Mathf.Clamp(-scrollx, -maxScroll, 0);
            scrolly = Mathf.Clamp(scrolly, 0, maxScroll);

            //Debug.Log($"{curSize} {px} {py} {scrollx} {scrolly} {maxScroll}");

            ContentContainer.GetComponent<RectTransform>().anchoredPosition = new Vector3(scrollx, scrolly, 0f);

            //playerMapIconObject.transform.localPosition = new Vector3(pos.x * 10f, pos.y * 10f, 0f);
            playerMapIconObject.transform.localRotation = Quaternion.Euler(0f, 0f, -angle);

            var s = 0.3f * ObjectScaleFactor * (1 / curSize);
        
            playerMapIconObject.transform.localScale = Vector3.one * s;
        }

        public void LoadMinimap(string mapName, MapType type)
        {
            if(loadCoroutine != null)
                StopCoroutine(loadCoroutine);

            gameObject.SetActive(true);
            ContentContainer.SetActive(false);
            //if(mapSprite != null)
            //    Destroy(mapSprite);
            mapSprite = null;
            //if(walkSprite != null)
            //    Destroy(walkSprite);
            walkSprite = null;
            MapType = type;

            loadCoroutine = StartCoroutine(LoadMinimapCoroutine(mapName));
        }

        public void SetZoom(float zoom)
        {
            zoom = Mathf.Clamp(zoom, minScale, maxScale);
            //Debug.Log($"Setting minimap size to {zoom} (in a range of {minScale} to {maxScale})");

            curSize = zoom;

            if (mapSprite == null)
                return;

            UpdateMapMaterial();

            var w = mapSprite.texture.width;
            var h = mapSprite.texture.height;

            MapImage.rectTransform.sizeDelta = new Vector2(w, h);

            var containerRect = ContentContainer.GetComponent<RectTransform>();
            containerRect.sizeDelta = MapImage.rectTransform.sizeDelta;
            containerRect.localScale = new Vector3(curSize, curSize, curSize);

            offsetX = 0f;
            offsetY = 0f;

            if (w != h && (w * curSize < 250 || h * curSize < 250))
            {

                if (w > h)
                    offsetY = -(w - h) / 2f;

                else
                    offsetX = (h - w) / 2f;

                MapImage.transform.localPosition = new Vector3(offsetX, offsetY, 0);
            }
            else
                MapImage.transform.localPosition = Vector3.zero;

            lastZoom = curSize;
        
            if(mapIcons.Count > 0)
                foreach(var icon in mapIcons)
                    SetEntityPosition(icon.Key, icon.Value.Type, icon.Value.Position);
        }

        public void UpdateZoomFromSlider()
        {
        
            SetZoom(LeanTween.easeInQuad(minScale, maxScale, ZoomSlider.value/ZoomSlider.maxValue));
        
            //SetZoom(ZoomSlider.value.Remap(ZoomSlider.minValue, ZoomSlider.maxValue, minScale, maxScale));
        }

        private void UpdateMapMaterial()
        {

            MapImage.sprite = mapSprite;

            if (MapType == MapType.Dungeon)
            {
                MapImage.sprite = walkSprite;
                MapImage.material = DungeonMaterial;
            }
            else
            {
                if (MapType == MapType.Town)
                {
                    //dungeon material but with regular map, so no highlighted walk
                    MapImage.material = DungeonMaterial;
                }
                else
                {
                    MapImage.material = OverworldMaterial;
                    if (walkSprite != null)
                        OverworldMaterial.SetTexture("_SecondaryTex", walkSprite.texture);
                }

            }
        }

        public IEnumerator LoadMinimapCoroutine(string mapName)
        {
            yield return new WaitForEndOfFrame();

            var mapKey = $"Assets/Maps/minimap/{mapName}.png";
            var walkKey = $"Assets/Maps/minimap/{mapName}_walkmask.png";

            //Asked before loading, not after. Addressables answers a key it has never heard
            //of by throwing InvalidKeyException out of LoadAssetAsync, so none of the checks
            //below ever get to run - the coroutine is already dead. Minimaps are rendered by
            //the lighting tool one map at a time, so a map that has not been through it yet
            //is the ordinary case and does not deserve a red line in the console.
            if (!ClientDataLoader.DoesAddressableExist<Sprite>(mapKey)
                || !ClientDataLoader.DoesAddressableExist<Sprite>(walkKey))
            {
                Debug.Log($"No minimap has been rendered for {mapName} yet, leaving the minimap blank.");
                yield break;
            }

            var loadMap = Addressables.LoadAssetAsync<Sprite>(mapKey);
            var loadWalk = Addressables.LoadAssetAsync<Sprite>(walkKey);

            yield return loadMap;
            yield return loadWalk;

            if (!loadWalk.IsDone || !loadWalk.IsValid() || !loadMap.IsDone || !loadMap.IsValid())
            {
                Debug.LogWarning("โหลดมินิแมพไม่สำเร็จ");
                yield break; //give up
            }

            //var map = loadMap.Result;

            mapSprite = loadMap.Result;
            walkSprite = loadWalk.Result;

            //An addressable key that isn't in the catalog still reports done and valid,
            //it simply hands back nothing. Every other use of mapSprite already checks
            //for that, this one didn't. It matters more than a blank minimap: WebGL is
            //built with exceptions limited to explicitly thrown ones, so dereferencing
            //the null here isn't a catchable error there, it takes the client down.
            if (mapSprite == null || mapSprite.texture == null)
            {
                Debug.LogWarning($"No minimap image is available for {mapName}, leaving the minimap blank.");
                yield break;
            }

            UpdateMapMaterial();

            minScale = 250f / mapSprite.texture.width;
        
            if (250f / mapSprite.texture.height < minScale)
                minScale = 250f / mapSprite.texture.height;

            maxScale = minScale * 6f;

            maxScale = Mathf.Clamp(maxScale, 2f, 10f);

            if (minScale > maxScale)
                maxScale = minScale;



            //var sprite = Sprite.Create(map, new Rect(0, 0, map.width, map.height), new Vector2(0, 1), 1);

            ContentContainer.transform.localPosition = new Vector3(0, 0, 0f);

            UpdateZoomFromSlider();

            ContentContainer.gameObject.SetActive(true);

            if (mapIcons.Count > 0)
            {
                foreach(var icon in mapIcons)
                    SetEntityPosition(icon.Key, icon.Value.Type, icon.Value.Position);
            }
        }

        void Awake()
        {
            instance = this;
            OverworldMaterial = new Material(OverworldMaterial);
            DungeonMaterial = new Material(DungeonMaterial);
        }

        // Start is called before the first frame update
        void Start()
        {
        
        }

        // Update is called once per frame
        void Update()
        {
            if(!Mathf.Approximately(curSize, lastZoom))
                SetZoom(curSize);
        }
    }
}
