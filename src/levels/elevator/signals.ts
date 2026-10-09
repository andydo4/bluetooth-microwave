// Tiny bits of state the controls hand to the 3D model, which only gets the shared ModelProps
// (no power level). Read every frame by Model.tsx, so plain mutable values are enough.
export const lift = {
  /** OPEN was pressed (power ≤ 5): the doors stay open while playing, which is why it sounds clearer. */
  doorsHeld: false,
  /** When ALARM was last pressed (performance.now() seconds): the alarm lamps flash for a moment. */
  alarmAt: -100,
}
