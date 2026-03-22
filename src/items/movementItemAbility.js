import {
  applyMapNowState as applyMapNowStateFromItem,
} from "./itemAbility";
import {
  applySkeletonKeyNowState as applySkeletonKeyNowStateFromSource,
  canUseNormalMovementNow as canUseNormalMovementNowFromSource,
  hasSkeletonKeyWallMoveAvailable as hasSkeletonKeyWallMoveAvailableFromSource,
} from "./skeletonKeyMagicCameraAbility";

export function applyMapNowState(game, viewedCard) {
  return applyMapNowStateFromItem(game, viewedCard);
}

export function canUseNormalMovementNow(game, viewedCard) {
  return canUseNormalMovementNowFromSource(game, viewedCard);
}

export function hasSkeletonKeyWallMoveAvailable(game, viewedCard, deps) {
  return hasSkeletonKeyWallMoveAvailableFromSource(game, viewedCard, deps);
}

export function applySkeletonKeyNowState(game, viewedCard, deps) {
  return applySkeletonKeyNowStateFromSource(game, viewedCard, deps);
}
