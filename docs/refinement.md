# Discretisation refinement check

The full-board DDR3 result should not depend on how finely the pipeline discretises the board. This
is a known-answer check by self-consistency: refine one knob at a time and require the far-end
receiver waveforms to stay within tolerances that were fixed before any refined run existed.

## Knobs

| Knob | Where | Baseline | Refined | Set from outside with |
|---|---|---|---|---|
| Ladder cell length | `src/simulation/route-ladder.ts`: `targetMm` = rise / 10 cells / refinement / delay, then the √(run delay / two rise times) shrink on long runs | refinement 1 | refinement 2 (every cell half as long) | `RoutedProblem.refinement`; `--refinement=2` |
| Transient max step | `src/simulation/routed-control.ts` `.tran step stop 0 step`, the plan's `maxStepSeconds` | the experiment step, min(UI / 100, edge / 20) = 12.31 ps on DDR3_ADDR_CMD | half of it, 6.16 ps | `RoutedProblem.stepSeconds`; `--step-seconds=…` |
| BEM panels per edge | `src/extraction/cross-section-mesh.ts`, through `RouteFieldsSolver` and the oblique-crossing solves | 12 | 18 (1.5×) | `RoutedProblem.panels`; `--panels=18` |

The three overrides are optional fields on `RoutedProblem`. Admission copies them into the block's
compile options, and the pipeline passes the panel count on to `RouteFieldsSolver`. Without them the
deck is unchanged.

## Metrics and tolerances (declared before the runs)

The metrics are measured on every far-end receiver probe. The tolerances apply to the change from the
baseline run, |refined − baseline|. VDDQ is 1.5 V.

| Metric | Definition | Tolerance | Why this size |
|---|---|---|---|
| Edge timing | each 50% (0.75 V) crossing; an edge counts once the trace has gone from below 20% to above 80% of VDDQ, or back | 5 ps | Under 0.5% of the 1.25 ns CK unit interval, and under half of the 12.3 ps baseline max step. A pass means the crossing does not depend on where the time steps or the cell boundaries fall. |
| Overshoot | max v − VDDQ | 10 mV | Under 0.7% of VDDQ and about 6% of the 175 mV DDR3 VIH(ac) margin above VREF. |
| Undershoot | −min v | 10 mV | Same as overshoot, against VIL(ac). |
| Waveform | max \|Δv\| over the whole run, on the union of both time grids | 25 mV | A 5 ps shift on a 5 V/ns edge, the fast end of DDR3 address and command slew, gives 25 mV. A larger difference means the shape changed, not only the timing. |

A different edge count on any probe is also a failure. The tolerances are in
`tests/support/refinement.ts` (`refinementTolerances`). They are never loosened to make a run pass.
A failure is a finding: it names the knob the result depends on, and by how much.

## Runs

All runs use the DDR3_ADDR_CMD block on the private full board: 8 ns, all 24 nets, one ngspice run each,
queued one at a time.

```sh
# Compile only, to check the existing baseline capture matches this commit's deck
bun scripts/run-routed-ddr3.tsx --addr-cmd --compile-only
# Refined runs
bun scripts/run-routed-ddr3.tsx --addr-cmd --refinement=2
bun scripts/run-routed-ddr3.tsx --addr-cmd --step-seconds=6.156942720776704e-12
bun scripts/run-routed-ddr3.tsx --addr-cmd --panels=18
# Compare
bun scripts/check-ddr3-refinement.tsx <baseline dir> <refined dir>...
```

Set `SI_DDR3_BOARD`, `IBIS_MODEL_DIR` and `SI_STAGE_VISUALS_DIR` (an ignored output directory) as for
`scripts/run-routed-ddr3.tsx`. The board, vendor models, decks and captures stay local.

The CI-sized version is `tests/support/refinement.test.tsx`. It runs a committed three-trace TSX board with
an original synthetic IBIS model at baseline and at each refined setting, under the same tolerances. It is
a native check, so it needs `SI_NATIVE_TESTS=1` and `ngspice` on `PATH`.

## Results

Pending.
