# Routed 2D coupled channel

This is an **experimental, unqualified path**, not an accepted DDR3 simulation.
`RouteFieldsSolver` extracts coefficients from scoped routed copper using the
[2D cross-section solver](2d-cross-section.md) for per-unit-length RLGC. No vendor
models, board JSON, generated netlists or plots are committed.

## Geometry and scope

`prepareBlockById` admits whole candidate nets within a 32 mm geometry cap
on the same/adjacent layers, including branched
and unmodelled neighbours. Only the selected channel graph must have supported
endpoint declarations. Quiet mapped IBIS pins retain their existing run states.
Unknown external loads are explicitly recorded as open/ideal-logical terminations;
this does not constitute a complete system/PDN model. Nearby rail wires are ideal
AC electrodes. Their longitudinal impedance is omitted.

The physical route is traversed through wires and explicit vias. A 1 um
Douglas–Peucker chord tolerance reduces dense curved-route tessellation, recording
original and simplified lengths. Width/layer/via boundaries survive. Parallel
overlapping copper of the same electrical net becomes its transverse metal
union, split at branch endpoints. Explicit lateral equipotential joins preserve
original endpoints; lateral spreading R/L
and patch-edge fringing remain omitted and recorded.

Parallel directions have local longitudinal/transverse frames. Sweeps split at
all longitudinal endpoints and intersections with actual pour outer/inner rings.
Groups use actual reference identity and solved pair coupling: retain a pair
when either normalized mutual C or L is at least 0.5%, then solve its connected
component. The 32 mm cap and 40-conductor admission limit are explicit; omitted
fields beyond the cap and aggregate waveform error are not bounded. Cache keys contain
only relative slice geometry and material profiles, not net names or position.
Actual PCB ports and branch junctions protect electrical cell boundaries.
Coplanar pours are not discretized into finite strip conductors in this revision;
pours supply vertical references only. Lateral coplanar shielding/coupling is
therefore an explicit remaining model gap, not a qualified full-copper solution.

The nearest *actual pour copper surface* on each side supplies the references.
Inner4 therefore sees intervening inner5 copper before inner6 when a power pour
is present; `power_references` records every such interval. A different-net plane
is an ideal AC reference approximation with an explicit PDN warning. Centre-line
boundary checks do not calculate 3D lateral edge fields. Where every vertical
reference is void, the nearest actual edge within 2 mm is replaced by a surface
at `hypot(vertical gap, lateral edge distance)`; every such surface records
`lateralGapMm`. This is an unqualified return-detour estimate. Larger unsupported
voids fail. Absent copper-layer volume is filled with the nearest laminate.
