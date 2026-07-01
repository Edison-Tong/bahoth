// Shared tile door-rotation helper. A tile's `doors` is an array of cardinal
// directions; rotating the tile shifts every door clockwise by one step.
const DIR_ORDER = ["N", "E", "S", "W"];

/** Returns every rotation of `doors` (as a door-direction array) that includes `neededDoor`. */
export function rotationsWithDoor(doors, neededDoor) {
  const rotations = [];
  for (let rot = 0; rot < 4; rot++) {
    const rotated = doors.map((door) => {
      const doorIndex = DIR_ORDER.indexOf(door);
      return DIR_ORDER[(doorIndex + rot) % 4];
    });
    if (rotated.includes(neededDoor)) rotations.push(rotated);
  }
  return rotations;
}
