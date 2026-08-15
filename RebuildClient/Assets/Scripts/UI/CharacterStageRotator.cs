using Assets.Scripts.Sprites;
using RebuildSharedData.Enum;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Assets.Scripts.UI
{
    /// <summary>
    /// Turns the character on the hub's stage, by dragging across him or by clicking.
    ///
    /// Not a rotation, because there is nothing to rotate: an RO character is eight
    /// drawings, one per facing, and turning him means picking a different one. That is
    /// also why the drag moves in steps rather than smoothly. Eight steps is a full turn,
    /// which is what the character creation screen gives you and what the player expects
    /// from having used it.
    /// </summary>
    public class CharacterStageRotator : MonoBehaviour, IBeginDragHandler, IDragHandler, IPointerClickHandler
    {
        private const int Facings = 8;

        /// <summary>
        /// How far the pointer travels for one step. Small enough that a short drag turns
        /// him a useful amount, large enough that a twitch does not spin him.
        /// </summary>
        private const float PixelsPerStep = 26f;

        private UiPlayerSprite sprite;
        private float travelled;
        private bool dragged;

        /// <summary>
        /// Found rather than assigned, because the preview is moved onto this stage after
        /// the stage is built and may not be there yet on the first frame.
        /// </summary>
        private UiPlayerSprite Sprite
        {
            get
            {
                if (sprite == null)
                    sprite = GetComponentInChildren<UiPlayerSprite>(true);
                return sprite;
            }
        }

        public void OnBeginDrag(PointerEventData eventData)
        {
            travelled = 0f;
            dragged = true;
        }

        public void OnDrag(PointerEventData eventData)
        {
            travelled += eventData.delta.x;

            //a long drag in one frame is several steps, so this consumes the distance
            //rather than testing it once
            while (Mathf.Abs(travelled) >= PixelsPerStep)
            {
                var step = travelled > 0f ? 1 : -1;
                travelled -= step * PixelsPerStep;
                Turn(step);
            }
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            //a drag ends with a click event too, and turning him once more at the end of
            //one would be a step the player did not ask for
            if (dragged)
            {
                dragged = false;
                return;
            }

            Turn(1);
        }

        private void Turn(int step)
        {
            var target = Sprite;
            if (target == null)
                return;

            var facing = ((int)target.ViewDirection + step) % Facings;
            if (facing < 0)
                facing += Facings;

            target.ChangeDirection((Direction)facing);
        }
    }
}
