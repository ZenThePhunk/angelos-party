// ─────────────────────────────────────────────────────────────
//  THE VENUE — measured off the Peerspace site plan.
//  Everything here is in FEET, the same as the plan.
//  x = feet from the band wall (west)   → garage door wall is x = 95
//  z = feet from the bar/bathroom wall (north) → seating wall is z = 42.2
// ─────────────────────────────────────────────────────────────
export const FT = 0.3048;

export const VENUE = {
  title: 'Austin & Bre',
  length: 95, depth: 42.2,
  wallHeight: 13.5,        // brick walls
  peakHeight: 20,          // top of the arched ceiling

  spawn: { x: 91, z: 14.7, facing: [-1, 0] },        // just inside the garage door, looking at the band

  garageDoor: { z1: 1.9, z2: 21.6 },                 // east wall
  frontDoor: { z1: 25, z2: 28.5 },                   // east wall
  redDoor: { z1: 27, z2: 32 },                       // west wall, behind the band
  brickX: { z1: 13, z2: 29 },                        // the big X on the band wall
  drape: { x1: 61.3, x2: 95 },                       // crushed velvet along the north wall

  bathrooms: [
    { x1: 0, z1: 0, x2: 20, z2: 8.5, door: 14 },
    { x1: 51.8, z1: 0, x2: 61.3, z2: 8.5, door: 56.5 },
  ],
  photoBooth: { x1: 20.6, z1: 1.2, x2: 24.2, z2: 7.6 },   // front faces the garage door
  tattoo: { x1: 28.4, z1: 0.2, x2: 41, z2: 8.3 },   // leaves a gap after the photo booth
  arcade: [
    { x: 44.2, name: 'FIST FURY', look: 'brawl' },
    { x: 47.4, name: 'PELLET PANIC', look: 'maze' },
    { x: 50.6, name: 'BLOOD DUEL', look: 'duel' },
  ],
  bar: { x1: 63.7, x2: 76.3, z1: 0.6, z2: 8.3, depth: 2.2 },
  band: { x1: 0.8, z1: 12.5, x2: 13.5, z2: 35.5 },
  chandelier: { x: 42, z: 21.1 },
  poolRug: { x1: 29.2, z1: 30.6, x2: 42.9, z2: 39.6 },
  poolTable: { x: 36, z: 35.2 },
  foodTable: { x1: 56.5, z1: 30.8, x2: 59.6, z2: 38.8 },
  gobo: { x: 58, y: 8.6 },                           // "The Angelos" on the seating wall
  diningTables: [
    { x: 70.9, z: 28.3 }, { x: 81.9, z: 28.3 },
    { x: 70.9, z: 35.5 }, { x: 81.9, z: 35.5 },
  ],
  blackHighTops: [[25.8, 41.18], [44.9, 41.18], [84.0, 17.9], [34.8, 10.0]],
  woodHighTops: [[23, 15.9], [29.6, 18.1], [29.6, 25.5], [23, 30.3]],
  spouseSpot: { x: 58, z: 19.5 },       // Austin & Bre, in line between the bathroom door and the food table
};
