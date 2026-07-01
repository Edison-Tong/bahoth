import { rotationsWithDoor } from "../shared/tileRotation";

/* [TILE-PLACEMENT] [VALIDATION] Returns all valid { floor, x, y, validRotations } placement slots adjacent to existing tiles that can accept at least one rotation of the incoming tile. */
export function getPlacementOptionsState(board, tile, DIR, OPPOSITE) {
  const placementsByCoord = new Map();

  for (const floor of tile.floors || []) {
    for (const baseTile of board[floor] || []) {
      for (const dir of baseTile.doors) {
        const { dx, dy } = DIR[dir];
        const x = baseTile.x + dx;
        const y = baseTile.y + dy;
        const occupied = board[floor]?.some((placedTile) => placedTile.x === x && placedTile.y === y);
        if (occupied) continue;

        const neededDoor = OPPOSITE[dir];
        const validRotations = rotationsWithDoor(tile.doors, neededDoor);

        if (validRotations.length === 0) continue;

        const key = `${floor}:${x}:${y}`;
        const existing = placementsByCoord.get(key);
        if (!existing) {
          placementsByCoord.set(key, {
            floor,
            x,
            y,
            validRotations,
          });
          continue;
        }

        const seen = new Set(existing.validRotations.map((rotation) => rotation.join("")));
        for (const rotation of validRotations) {
          const rotationKey = rotation.join("");
          if (seen.has(rotationKey)) continue;
          seen.add(rotationKey);
          existing.validRotations.push(rotation);
        }
      }
    }
  }

  return Array.from(placementsByCoord.values());
}
