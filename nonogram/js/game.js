/* ============================================================
   NONOGRAM GAME
   ============================================================ */
(function () {
  'use strict';

  // ── Puzzle Data ──────────────────────────────────────────
  // Each puzzle: { name, data: 2D array (1=filled, 0=empty) }
  const PUZZLES = {
    easy: [
      { name: 'Heart', data: [
        [0,1,0,1,0],
        [1,1,1,1,1],
        [1,1,1,1,1],
        [0,1,1,1,0],
        [0,0,1,0,0]
      ]},
      { name: 'Cross', data: [
        [0,0,1,0,0],
        [0,0,1,0,0],
        [1,1,1,1,1],
        [0,0,1,0,0],
        [0,0,1,0,0]
      ]},
      { name: 'Arrow', data: [
        [0,0,1,0,0],
        [0,1,1,1,0],
        [1,0,1,0,1],
        [0,0,1,0,0],
        [0,0,1,0,0]
      ]},
      { name: 'Diamond', data: [
        [0,0,1,0,0],
        [0,1,0,1,0],
        [1,0,0,0,1],
        [0,1,0,1,0],
        [0,0,1,0,0]
      ]},
      { name: 'Square', data: [
        [1,1,1,1,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,1]
      ]},
      { name: 'Stairs', data: [
        [1,0,0,0,0],
        [1,1,0,0,0],
        [1,1,1,0,0],
        [1,1,1,1,0],
        [1,1,1,1,1]
      ]},
      { name: 'X', data: [
        [1,0,0,0,1],
        [0,1,0,1,0],
        [0,0,1,0,0],
        [0,1,0,1,0],
        [1,0,0,0,1]
      ]},
      { name: 'Smile', data: [
        [0,1,0,1,0],
        [0,1,0,1,0],
        [0,0,0,0,0],
        [1,0,0,0,1],
        [0,1,1,1,0]
      ]},
      { name: 'Flag', data: [
        [1,1,1,1,0],
        [1,1,1,1,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0]
      ]},
      { name: 'T', data: [
        [1,1,1,1,1],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0]
      ]}
    ],
    medium: [
      { name: 'Umbrella', data: [
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,1,0,0,0,0,0],
        [0,0,0,0,1,0,0,0,0,0],
        [0,0,0,0,1,0,0,0,0,0],
        [0,0,0,0,1,0,0,0,0,0],
        [1,0,0,0,1,0,0,0,0,0],
        [0,1,1,1,0,0,0,0,0,0]
      ]},
      { name: 'House', data: [
        [0,0,0,0,1,0,0,0,0,0],
        [0,0,0,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,0,0,0],
        [0,1,1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,1,0,0],
        [0,1,1,0,0,0,1,1,0,0],
        [0,1,1,0,0,0,1,1,0,0],
        [0,1,1,0,0,0,1,1,0,0],
        [0,1,1,1,1,1,1,1,0,0]
      ]},
      { name: 'Cup', data: [
        [0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,1,0,0],
        [0,0,1,1,1,1,1,0,0,0],
        [0,0,0,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,0,0,0],
        [0,1,1,1,1,1,1,1,0,0]
      ]},
      { name: 'Anchor', data: [
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0],
        [1,0,0,0,1,1,0,0,0,1],
        [1,1,0,0,1,1,0,0,1,1],
        [0,1,1,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,1,1,0,0]
      ]},
      { name: 'Star', data: [
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,1,1,1,0,0,1,1,1,0],
        [0,1,1,0,0,0,0,1,1,0],
        [1,1,0,0,0,0,0,0,1,1],
        [1,0,0,0,0,0,0,0,0,1]
      ]},
      { name: 'Tree', data: [
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,0],
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0]
      ]},
      { name: 'Fish', data: [
        [0,0,0,1,0,0,0,0,0,0],
        [0,0,1,1,1,0,0,0,0,0],
        [0,1,1,1,1,1,1,0,0,1],
        [1,1,1,0,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,1,1,0,0],
        [1,1,1,0,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,0,0,1],
        [0,0,1,1,1,0,0,0,0,0],
        [0,0,0,1,0,0,0,0,0,0]
      ]},
      { name: 'Rocket', data: [
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,1,1,0],
        [1,1,0,1,1,1,1,0,1,1],
        [1,0,0,0,1,1,0,0,0,1]
      ]},
      { name: 'Music', data: [
        [0,0,0,1,1,1,1,1,1,0],
        [0,0,0,1,0,0,0,0,1,0],
        [0,0,0,1,0,0,0,0,1,0],
        [0,0,0,1,0,0,0,0,1,0],
        [0,0,0,1,0,0,0,0,1,0],
        [0,0,0,1,0,0,0,0,1,0],
        [0,0,0,1,0,0,0,0,1,0],
        [1,1,0,1,0,1,1,0,1,0],
        [1,1,1,1,0,1,1,1,1,0],
        [0,1,1,0,0,0,1,1,0,0]
      ]},
      { name: 'Boat', data: [
        [0,0,0,1,0,0,0,0,0,0],
        [0,0,0,1,1,0,0,0,0,0],
        [0,0,0,1,0,1,0,0,0,0],
        [0,0,0,1,0,0,1,0,0,0],
        [0,0,0,1,0,0,0,1,0,0],
        [0,0,0,1,0,0,0,0,1,0],
        [1,1,1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,0,0,1,1,1,1,0,0,0]
      ]}
    ],
    hard: [
      { name: 'Cat', data: [
        [1,1,0,0,0,0,0,0,0,0,0,0,0,1,1],
        [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
        [1,0,1,1,0,0,0,0,0,0,0,1,1,0,1],
        [1,0,0,1,1,1,1,1,1,1,1,1,0,0,1],
        [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,0,1,0,1,1,1,1,1,0,1,0,0,0],
        [0,0,0,1,1,1,0,1,0,1,1,1,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,1,1,0,0,0,0,0,1,1,0,0,0],
        [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
        [0,0,0,1,1,0,0,0,0,0,1,1,0,0,0],
        [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0]
      ]},
      { name: 'Skull', data: [
        [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,1,1,0,0,1,1,1,1,1,0,0,1,1,0],
        [0,1,1,0,0,1,1,1,1,1,0,0,1,1,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,0,1,0,1,1,1,1,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,0,0,1,0,1,0,1,0,1,0,0,0,0],
        [0,0,0,0,1,0,1,0,1,0,1,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]},
      { name: 'Mushroom', data: [
        [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,1,1,0,0,1,1,1,0,0,1,1,0,0],
        [0,1,1,0,0,0,1,1,1,0,0,0,1,1,0],
        [0,1,1,0,0,0,1,1,1,0,0,0,1,1,0],
        [1,1,1,1,0,0,1,1,1,0,0,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0]
      ]},
      { name: 'Robot', data: [
        [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,1,0,1,0,1,0,1,0,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,1,0,0,0,1,0,0,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,0,0,0,0,0,1,1,0,0,0,0],
        [0,0,1,1,0,0,0,0,0,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,1,1,0,1,1,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,1,1,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,1,1,0,0,0,0,0,0],
        [0,0,0,1,1,1,0,1,1,1,0,0,0,0,0]
      ]},
      { name: 'Flower', data: [
        [0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
        [0,0,1,1,0,1,1,1,0,1,1,0,0,0,0],
        [0,1,1,1,1,0,1,0,1,1,1,1,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,1,1,0,1,1,1,0,1,1,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,0,1,0,0,0,0,0,0,0,0],
        [0,0,0,1,0,0,1,0,0,0,0,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]},
      { name: 'Plane', data: [
        [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        [1,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
        [1,1,0,0,1,1,1,1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,1,1,0,1,0,1,1,0,0,0,0],
        [0,0,0,1,1,0,0,1,0,0,1,1,0,0,0],
        [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]
      ]},
      { name: 'Key', data: [
        [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
        [0,0,1,1,0,0,1,1,0,0,0,0,0,0,0],
        [0,0,1,0,0,0,0,1,0,0,0,0,0,0,0],
        [0,0,1,0,0,0,0,1,0,0,0,0,0,0,0],
        [0,0,1,1,0,0,1,1,0,0,0,0,0,0,0],
        [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0]
      ]},
      { name: 'Crown', data: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,0,0,0,1,0,0,0,1,0,0,0,0],
        [0,0,1,0,0,0,1,0,0,0,1,0,0,0,0],
        [0,0,1,1,0,0,1,0,0,1,1,0,0,0,0],
        [0,0,1,1,0,1,1,1,0,1,1,0,0,0,0],
        [0,1,1,1,0,1,1,1,0,1,1,1,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,0,1,0,1,0,1,0,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]},
      { name: 'Ghost', data: [
        [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,0,0,1,1,0,0,1,0,0,0,0],
        [0,0,1,1,0,0,1,1,0,0,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,0,1,1,0,1,1,0,1,0,0,0,0],
        [0,0,1,0,0,1,0,0,1,0,1,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]},
      { name: 'Castle', data: [
        [1,0,1,0,0,0,0,0,0,0,0,0,1,0,1],
        [1,0,1,0,0,0,1,0,0,0,0,0,1,0,1],
        [1,1,1,0,0,0,1,0,0,0,0,0,1,1,1],
        [1,1,1,0,0,1,1,1,0,0,0,0,1,1,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,1,1,0,0,1,1,1,1,1,0,0,1,1,0],
        [0,1,1,0,0,1,1,1,1,1,0,0,1,1,0],
        [0,1,1,0,0,1,0,1,0,1,0,0,1,1,0],
        [0,1,1,0,0,1,0,1,0,1,0,0,1,1,0],
        [0,1,1,1,1,1,0,1,0,1,1,1,1,1,0],
        [0,1,1,1,1,1,0,1,0,1,1,1,1,1,0],
        [0,1,1,1,1,1,0,0,0,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0]
      ]}
    ]
  };

  // ── State ──────────────────────────────────────────────
  let difficulty = 'easy';
  let puzzleIndex = 0;
  let solution = [];
  let gridSize = 5;
  let playerGrid = [];     // 0=empty, 1=filled, 2=marked(X)
  let mode = 'fill';       // 'fill' or 'mark'
  let timerInterval = null;
  let seconds = 0;
  let gameActive = false;
  let isDragging = false;
  let dragMode = null;     // what action to apply while dragging

  // ── DOM ────────────────────────────────────────────────
  const $ = (s) => document.getElementById(s);

  const overlayStart = $('overlay-start');
  const overlayWin = $('overlay-win');
  const gridEl = $('grid');
  const rowCluesEl = $('row-clues');
  const colCluesEl = $('col-clues');
  const cornerEl = $('corner-spacer');
  const boardEl = $('nonogram-board');
  const timerEl = $('timer');
  const puzzleNumEl = $('puzzle-number');
  const modeToggle = $('mode-toggle');
  const modeIcon = $('mode-icon');
  const modeLabel = $('mode-label');
  const btnStart = $('btn-start');
  const btnNext = $('btn-next');
  const btnRestartWin = $('btn-restart-win');
  const btnReset = $('btn-reset');
  const winTime = $('win-time');
  const winBest = $('win-best');
  const newRecordBadge = $('new-record-badge');
  const startBestDisplay = $('start-best-display');

  // ── Difficulty selection ──────────────────────────────
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      difficulty = btn.dataset.diff;
      updateStartBest();
    });
  });

  function updateStartBest() {
    const best = getBestTime();
    startBestDisplay.textContent = best ? `최고 기록: ${formatTime(best)}` : '';
  }

  // ── Clue generation ──────────────────────────────────
  function generateClues(line) {
    const clues = [];
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === 1) {
        count++;
      } else if (count > 0) {
        clues.push(count);
        count = 0;
      }
    }
    if (count > 0) clues.push(count);
    return clues.length === 0 ? [0] : clues;
  }

  function getRowClues() {
    return solution.map(row => generateClues(row));
  }

  function getColClues() {
    const clues = [];
    for (let c = 0; c < gridSize; c++) {
      const col = solution.map(row => row[c]);
      clues.push(generateClues(col));
    }
    return clues;
  }

  // ── Check if line clue is satisfied ──────────────────
  function isLineSatisfied(playerLine, clue) {
    const playerClue = generateClues(playerLine.map(v => v === 1 ? 1 : 0));
    if (playerClue.length !== clue.length) return false;
    return playerClue.every((v, i) => v === clue[i]);
  }

  // ── Build board ──────────────────────────────────────
  function buildBoard() {
    const puzzles = PUZZLES[difficulty];
    puzzleIndex = puzzleIndex % puzzles.length;
    solution = puzzles[puzzleIndex].data;
    gridSize = solution.length;
    playerGrid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

    puzzleNumEl.textContent = `${puzzleIndex + 1}/${puzzles.length}`;

    const rowClues = getRowClues();
    const colClues = getColClues();

    // Calculate max clue lengths for sizing
    const maxRowClueLen = Math.max(...rowClues.map(c => c.length));
    const maxColClueLen = Math.max(...colClues.map(c => c.length));

    // Responsive cell sizing
    const availW = Math.min(window.innerWidth - 16, 500);
    const availH = window.innerHeight - 160;
    const clueRowW = maxRowClueLen * (gridSize <= 5 ? 24 : gridSize <= 10 ? 20 : 16);
    const clueColH = maxColClueLen * (gridSize <= 5 ? 22 : gridSize <= 10 ? 18 : 15);
    const gridAvailW = availW - clueRowW;
    const gridAvailH = availH - clueColH;
    const cellSize = Math.floor(Math.min(gridAvailW / gridSize, gridAvailH / gridSize, gridSize <= 5 ? 52 : gridSize <= 10 ? 36 : 26));

    const clueFontSize = gridSize <= 5 ? '14px' : gridSize <= 10 ? '11px' : '9px';
    const markFontSize = gridSize <= 5 ? '16px' : gridSize <= 10 ? '12px' : '9px';

    document.documentElement.style.setProperty('--clue-font', clueFontSize);
    document.documentElement.style.setProperty('--mark-font', markFontSize);

    // Setup grid template
    boardEl.style.gridTemplateColumns = `${clueRowW}px ${cellSize * gridSize + gridSize - 1}px`;
    boardEl.style.gridTemplateRows = `${clueColH}px ${cellSize * gridSize + gridSize - 1}px`;

    cornerEl.style.width = clueRowW + 'px';
    cornerEl.style.height = clueColH + 'px';

    // Build col clues
    colCluesEl.innerHTML = '';
    colCluesEl.style.width = (cellSize * gridSize + gridSize - 1) + 'px';
    colClues.forEach((clue, ci) => {
      const div = document.createElement('div');
      div.className = 'col-clue';
      div.style.width = cellSize + 'px';
      if (ci < gridSize - 1) div.style.marginRight = '1px';
      div.dataset.col = ci;
      clue.forEach((n, ni) => {
        const s = document.createElement('span');
        s.textContent = n;
        s.dataset.clueIdx = ni;
        div.appendChild(s);
      });
      colCluesEl.appendChild(div);
    });

    // Build row clues
    rowCluesEl.innerHTML = '';
    rowCluesEl.style.height = (cellSize * gridSize + gridSize - 1) + 'px';
    rowClues.forEach((clue, ri) => {
      const div = document.createElement('div');
      div.className = 'row-clue';
      div.style.height = cellSize + 'px';
      if (ri < gridSize - 1) div.style.marginBottom = '1px';
      div.dataset.row = ri;
      clue.forEach((n, ni) => {
        const s = document.createElement('span');
        s.textContent = n;
        s.dataset.clueIdx = ni;
        div.appendChild(s);
      });
      rowCluesEl.appendChild(div);
    });

    // Build grid cells
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${gridSize}, ${cellSize}px)`;
    gridEl.style.gridTemplateRows = `repeat(${gridSize}, ${cellSize}px)`;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Thick borders every 5 cells
        if (gridSize > 5) {
          if (c % 5 === 4 && c !== gridSize - 1) cell.classList.add('border-right');
          if (r % 5 === 4 && r !== gridSize - 1) cell.classList.add('border-bottom');
        }

        cell.addEventListener('pointerdown', onCellPointerDown);
        cell.addEventListener('pointerenter', onCellPointerEnter);
        gridEl.appendChild(cell);
      }
    }

    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    updateClueHighlights();
  }

  // ── Cell interaction ─────────────────────────────────
  function onCellPointerDown(e) {
    if (!gameActive) return;
    e.preventDefault();
    isDragging = true;

    const r = +e.target.dataset.row;
    const c = +e.target.dataset.col;
    const current = playerGrid[r][c];

    if (mode === 'fill') {
      dragMode = current === 1 ? 'unfill' : 'fill';
    } else {
      dragMode = current === 2 ? 'unmark' : 'mark';
    }

    applyAction(r, c);
    e.target.releasePointerCapture(e.pointerId);
  }

  function onCellPointerEnter(e) {
    if (!isDragging || !gameActive) return;
    const r = +e.target.dataset.row;
    const c = +e.target.dataset.col;
    applyAction(r, c);
  }

  function onPointerUp() {
    isDragging = false;
    dragMode = null;
  }

  function applyAction(r, c) {
    const current = playerGrid[r][c];
    switch (dragMode) {
      case 'fill':
        if (current !== 1) playerGrid[r][c] = 1;
        break;
      case 'unfill':
        if (current === 1) playerGrid[r][c] = 0;
        break;
      case 'mark':
        if (current !== 2) playerGrid[r][c] = 2;
        break;
      case 'unmark':
        if (current === 2) playerGrid[r][c] = 0;
        break;
    }
    renderCell(r, c);
    updateClueHighlights();
    checkWin();
  }

  function renderCell(r, c) {
    const idx = r * gridSize + c;
    const cell = gridEl.children[idx];
    cell.classList.remove('filled', 'marked');
    if (playerGrid[r][c] === 1) cell.classList.add('filled');
    else if (playerGrid[r][c] === 2) cell.classList.add('marked');
  }

  function renderAllCells() {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        renderCell(r, c);
      }
    }
  }

  // ── Clue highlighting ────────────────────────────────
  function updateClueHighlights() {
    const rowClues = getRowClues();
    const colClues = getColClues();

    // Row clues
    rowCluesEl.querySelectorAll('.row-clue').forEach((div, ri) => {
      const playerRow = playerGrid[ri];
      const satisfied = isLineSatisfied(playerRow, rowClues[ri]);
      div.querySelectorAll('span').forEach(s => {
        s.classList.toggle('satisfied', satisfied);
      });
    });

    // Col clues
    colCluesEl.querySelectorAll('.col-clue').forEach((div, ci) => {
      const playerCol = playerGrid.map(row => row[ci]);
      const satisfied = isLineSatisfied(playerCol, colClues[ci]);
      div.querySelectorAll('span').forEach(s => {
        s.classList.toggle('satisfied', satisfied);
      });
    });
  }

  // ── Win check ────────────────────────────────────────
  function checkWin() {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const filled = playerGrid[r][c] === 1;
        if (filled !== (solution[r][c] === 1)) return;
      }
    }
    // Win!
    gameActive = false;
    clearInterval(timerInterval);
    showWinAnimation();
  }

  function showWinAnimation() {
    const cells = gridEl.querySelectorAll('.cell');
    cells.forEach((cell, i) => {
      setTimeout(() => {
        cell.classList.add('win-pop');
      }, i * 20);
    });

    setTimeout(() => {
      showWinOverlay();
    }, cells.length * 20 + 400);
  }

  function showWinOverlay() {
    const timeStr = formatTime(seconds);
    winTime.textContent = timeStr;

    const bestKey = `nonogram_best_${difficulty}`;
    const prevBest = parseInt(localStorage.getItem(bestKey) || '0', 10);

    if (prevBest === 0 || seconds < prevBest) {
      localStorage.setItem(bestKey, seconds);
      winBest.textContent = timeStr;
      newRecordBadge.classList.remove('hidden');
    } else {
      winBest.textContent = formatTime(prevBest);
      newRecordBadge.classList.add('hidden');
    }

    overlayWin.classList.remove('hidden');
  }

  // ── Timer ────────────────────────────────────────────
  function startTimer() {
    seconds = 0;
    timerEl.textContent = '0:00';
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      seconds++;
      timerEl.textContent = formatTime(seconds);
    }, 1000);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function getBestTime() {
    return parseInt(localStorage.getItem(`nonogram_best_${difficulty}`) || '0', 10);
  }

  // ── Mode toggle ──────────────────────────────────────
  modeToggle.addEventListener('click', () => {
    if (mode === 'fill') {
      mode = 'mark';
      modeIcon.textContent = '✕';
      modeLabel.textContent = 'X표시 모드';
      modeToggle.classList.add('mark-mode');
    } else {
      mode = 'fill';
      modeIcon.textContent = '✏️';
      modeLabel.textContent = '채우기 모드';
      modeToggle.classList.remove('mark-mode');
    }
  });

  // ── Start game ───────────────────────────────────────
  function startGame() {
    overlayStart.classList.add('hidden');
    overlayWin.classList.add('hidden');
    mode = 'fill';
    modeIcon.textContent = '✏️';
    modeLabel.textContent = '채우기 모드';
    modeToggle.classList.remove('mark-mode');
    buildBoard();
    startTimer();
    gameActive = true;
  }

  btnStart.addEventListener('click', () => {
    puzzleIndex = 0;
    startGame();
  });

  btnNext.addEventListener('click', () => {
    puzzleIndex++;
    if (puzzleIndex >= PUZZLES[difficulty].length) {
      puzzleIndex = 0;
    }
    startGame();
  });

  btnRestartWin.addEventListener('click', () => {
    startGame();
  });

  btnReset.addEventListener('click', () => {
    if (!gameActive) return;
    playerGrid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    renderAllCells();
    updateClueHighlights();
  });

  // ── Keyboard shortcut ────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      modeToggle.click();
    }
  });

  // ── Prevent context menu on long press ──────────────
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // ── Initial state ────────────────────────────────────
  updateStartBest();
})();
