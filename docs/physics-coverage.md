# Physics coverage

The routed pipeline is quasi-TEM 2.5D: boundary-element cross-sections between infinite
reference planes (`extraction/cross-section.ts`), a nine-pole causal Foster loss fit
(`extraction/causal-loss.ts`), lumped π ladders (`simulation/route-ladder.ts`), lumped via
and pad corrections (`simulation/route-transitions.ts`) and IBIS buffers with vendor packages
(`buffers/package.ts`). [Golden checks](golden-checks.md) show the cross-sections and ladders
solve their own model correctly. This page lists what the model leaves out, and how much that
could matter for the DDR3 address/command block.

Status: **modelled** means the effect is in the deck from geometry. **Approximated** means it is in
the deck through a closed-form or assumed value. **Missing** means it is not in the deck at all.

## Reference case for the impact estimates

The estimates below use aggregates from the 8 ns DDR3_ADDR_CMD baseline run at HEAD
(`evidence.json`, private board, never committed):

| Quantity | Value |
|---|---|
| Routes | 24 addr/cmd nets, 39.5–41.8 mm long (median 40.8 mm), 0.1 mm wide, mostly inner-layer stripline |
| Line | median self Z0 59.5 Ω, 6.07 ps/mm, so about 250 ps one-way |
| Loss at 1 GHz, 40 mm | conductor 0.15 dB, dielectric about 0.15 dB (tan δ 0.02 assumed) |
| Vias | 101 signal vias, all blind or buried with zero stub; barrel L 0.21–0.97 nH (median 0.51 nH), C 0.08–0.27 pF |
| Nearest ground via | 0.40–8.2 mm from the signal via (median 1.8 mm) |
| Reference planes | 745 of 4,563 slices reference a power net; 453 slices sit over a plane void and use the edge substitute |
| Neighbours | 162 neighbour port bodies, open or ideal-logic terminated |

Signalling: 400 Mbps, 2.5 ns unit interval, 1.5 V swing, edges about 0.3–1 ns. The knee
frequency 0.35/t_r is 0.35–1.2 GHz. Two simple yardsticks recur below:

- A lumped shunt C on a Z0 line reflects about ρ ≈ Z0·C / (2 t_r). For Z0 = 50 Ω and t_r = 0.3 ns that is 0.083 % per fF, so 8 % per pF.
- A lumped series L reflects about ρ ≈ L / (2 Z0 t_r), so 3.3 % per nH.

(Hall, Hall & McCall, *High-Speed Digital System Design*, §4.4; Bogatin, *Signal and Power Integrity — Simplified*, 3rd ed., §8.11–8.12.)
Values are percent of the incident step and of the 1.5 V swing; 1 % is 15 mV.

## Coverage

| # | Effect | Status | Evidence | DDR3 addr/cmd impact estimate |
|---|---|---|---|---|
| 1 | Via barrel L/C | Approximated | `simulation/route-transitions.ts:29-37` (regularised short-via L, coaxial barrel C), `:74-79`, `:109` (R–L series, C split ½/½) | Median 0.51 nH and 0.16 pF. These partly cancel: Z_via = √(L/C) ≈ 56 Ω, close to the line. If either is 50 % off, the uncancelled part is about 0.25 nH or 0.08 pF, about 0.8 % reflection, 12 mV. **Low.** |
| 2 | Via stubs | Modelled (zero on this board) | `route-transitions.ts:110-117`. The stub is barrel span minus the used span, from `pcb_via.layers` | Every DDR3 via is blind or buried and ends on a used layer, so all 101 stubs are 0 mm. No error on this board. A through via used top→inner1 on a 1.6 mm board would leave a 1.4 mm stub resonating near 25 GHz. That is out of band. |
| 3 | Antipads | Approximated (assumed diameter) | `route-transitions.ts:76`: antipad = pad + 0.20 mm, used only in barrel C; plane voids around barrels are not read from the board | C ∝ 1/ln(antipad/barrel). A 0.2 mm error in the antipad changes the barrel C by about 25 %, which is 0.04 pF or 0.3 % reflection. **Low.** |
| 4 | Reference-plane change at a via, return via | Approximated | `route-transitions.ts:80-107`: nearest spanning GND via. L_ret = 0.2 nH/mm · Δz · ln(1 + 2d/d_hole). With no stitch, it uses 10 mm (`:106`, `:119`) | The median 1.8 mm stitch gives 0–0.49 nH over a 0.1–0.3 mm plane spacing, so 1.6 % at most. The real return path also spreads through the plane cavity, which the formula leaves out. Cavity spreading inductance for a 1.8 mm stitch at 0.3 mm spacing is about 0.1–0.3 nH more (Novak, DesignCon 2005, "Lessons learned from power-plane cavity modelling"), so under 1 % more reflection. **Low–moderate.** |
| 5 | Return path through a power-net reference (GND→VDD transitions, power-referenced stripline) | Missing (ideal AC ground) | `simulation/route-network.ts:115`, `route-transitions.ts:120`; power pours are ideal references in `board/route-sections.ts:42-51` | 745 slices reference a power net. Where the return jumps planes, its current goes through decoupling capacitors: about 0.5–1 nH of mounted capacitor plus spreading, and the planes' cavity impedance. A 1 nH series return discontinuity gives about 3.3 % reflection (50 mV). It is shared by every line crossing at that point, so it also couples them. **Moderate. The largest single-line omission.** |
| 6 | Gaps, splits and voids under traces | Approximated | `board/route-sections.ts:52-69` (nearest edge within 2 mm, displaced by hypot of vertical and lateral gap) and `:72-88` (exact centre-line cuts) | 453 of 4,563 slices (about 10 %) run over a void with no vertical reference. The substitute keeps a TEM line at a larger height but has no return detour. Crossing a 1 mm split with a 10 mm detour adds about 5–10 nH, a 17–33 % reflection (Bogatin §9.9). That holds only if the void is a true split. A local antipad cluster is much smaller. **Potentially high, unquantified. This is the first openEMS target.** |
| 7 | IBIS package R/L/C | Modelled (AM335x coupled matrix, Winbond [Pin] scalars), one lumped π | `buffers/package.ts:54-85` (scalars), `buffers/coupled-package.ts:46-75` (coupled R/L/C, one π section) | Package flight time √(L·C) ≈ √(4 nH · 1 pF) ≈ 63 ps, against a 300 ps edge. One π section is accurate to about t_r/6 ≈ 50 ps, so it is marginal. The error is a smoothing of package ringing above about 2.5 GHz, roughly 1–2 % of swing. **Low.** |
| 8 | Power-rail and ground noise (SSO) | Missing (ideal die rails) | `buffers/package.ts:8`, `:78` (`VPDN` ideal sources), `:104`; `route-network.ts:115` | 12 of 24 lines switching one way, each about 20 mA into VTT, edge 0.5 ns, so about 0.5 A/ns. With an effective shared GND/VDDQ path of 0.05–0.1 nH (many balls in parallel), that is 25–50 mV of rail collapse, 2–3 % of swing, plus the matching crosstalk. JEDEC DDR3 budgets about 5 % of VDDQ for SSN. **Moderate. The largest system-level omission.** |
| 9 | Copper roughness | Missing | `route-network.ts:112` (warning); no roughness factor in `extraction/cross-section.ts:79`, `:91-101` | Hammerstad K = 1 + (2/π)·atan(1.4(Rq/δ)²). With δ(1 GHz) = 2.1 µm and Rq = 1–2 µm, K = 1.2–1.6. That adds 0.03–0.09 dB at 1 GHz over 40 mm, and under 0.02 dB at the 200 MHz fundamental. Under 1 % of eye height. **Negligible.** |
| 10 | Frequency-dependent Dk/Df | Approximated (wideband constant-tan δ, assumed tan δ) | `extraction/causal-loss.ts:4-18` (nine Debye/Foster poles, 10 MHz–5 GHz), `simulation/route-ladder.ts:147-151` (Dk referenced at 1 GHz); tan δ 0.02 assumed in `extraction/route-fields-solver.ts:21` | Causality and dispersion are in. The values are not measured: real FR-4 has tan δ 0.015–0.025, which moves dielectric loss by ±0.04 dB at 1 GHz over 40 mm. Dk at 1 GHz off by ±0.1 changes delay by ±1.2 % (±3 ps). **Low.** |
| 11 | Solder mask | Approximated (planar slab) | `extraction/route-lines.ts:27-44`; thickness from the stackup or 0.02 mm assumed, εr 3.3, tan δ 0.025 (`route-fields-solver.ts:21`) | Only outer-layer breakouts see mask, and those are a few mm of each 40 mm route. Planar versus conformal mask moves microstrip Z0 by about 1–2 Ω. **Negligible.** |
| 12 | Non-TEM effects at bends | Missing (bend excess C, current crowding) | `route-network.ts:112` (warning); `simulation/route-ladder.ts:53-70` follows the polyline length only | Excess C of a 90° corner of a 0.1 mm trace is about ε·w²/h ≈ 4 fF, so 0.03 % reflection. Most routing is 45°, which is less. **Negligible.** |
| 13 | Coupling to non-simulated aggressor nets | Approximated (scope cap, pair screen, quiet neighbours) | `board/geometry/scope.ts:24-29`, `:127` (32 mm cap; same or adjacent layers only), `extraction/route-fields-solver.ts:87` (0.5 % pair screen), `route-network.ts:113-116` (neighbour-to-neighbour oblique omitted; 162 neighbour ports open or ideal), `simulation/route-oblique.ts:65` (oblique magnetic term omitted) | Neighbours inside the scope are coupled but quiet. Nets of other blocks (DQ, clock) never switch in this block. Stripline backward crosstalk is k_b = ¼(Cm/C + Lm/L). The strongest retained pair has k ≈ 0.10, so k_b ≈ 5 %: 75 mV per adjacent switching aggressor that the block holds quiet. Stripline forward crosstalk is close to 0. **Moderate where a different-block net runs alongside. Coupling inside the block is modelled.** |
| 14 | Discontinuities at pads and breakouts | Approximated | `route-transitions.ts:39-48`, `:123-137` (parallel-plate pad C), `:142` (fringing and current crowding omitted); `board/route-sections.ts:122` (equipotential lateral joins) | Pad C 4.7 fF–0.42 pF (median 13 fF). Parallel-plate C under-estimates small pads by 20–50 % from fringing, so up to about 0.2 pF on the largest, which is 1.7 % reflection. BGA ball and escape inductance is not in the routed copper. **Low–moderate.** |
| 15 | Plane cavity resonance, radiation, conductor DC drop in planes | Missing | `route-transitions.ts:141` (ideal equipotential planes); `extraction/cross-section-types.ts:44` (planes have zero DC resistance) | The first cavity mode of a board about 50 mm across is about 1.5 GHz/√εr ≈ 0.7 GHz. That is in band, but it is excited only through return-path transitions (rows 4–5). It shows up as row 5's error, not as a separate term. |

### Ranking of what is missing or approximated

1. **Plane voids and splits under the route (row 6).** 10 % of slices, with an unknown detour. Up to tens of percent locally if any is a real split.
2. **Return through power-referenced planes and SSO (rows 5 and 8).** 2–3 % of swing each. They interact, and the pipeline has neither.
3. **Different-block aggressors (row 13).** Up to about 5 % backward crosstalk per adjacent switching net.
4. Everything else is at most about 1–2 % of swing.

## Full-wave cross-check against openEMS

### Method (fixed before any openEMS run)

`scripts/openems-net.ts` takes one routed net, plus every scoped neighbour that the pipeline
couples to it, from the pipeline's own board data. That data is `segmentRoutes` wires and pours,
the stackup, the physical `pcb_via` barrels and the port pads. It writes two files for the net:

- **`model.json`** for openEMS. `tools/openems/run_net.py` reads it, builds the CSXCAD geometry and
  runs FDTD. Copper traces, pads and pours are boxes with their real thickness. Vias are solid
  barrels with pads on their connected layers. The antipad uses the pipeline's assumed diameter
  (pad + 0.2 mm) in every plane the barrel crosses that is not on its own net. Each port is a
  50 Ω lumped port from the pad down to the nearest reference plane.
- **`ladder.cir`** for ngspice. It is the pipeline's own `routeLadder` and `routeTransitions` (and
  `routeOblique`, when neighbours are present) for the same net, with the same 50 Ω ports, run as
  `.ac` from 10 MHz to 5 GHz.

The same post-processing (`tools/openems/compare.py`) turns both S-parameter sets into a TDR
impedance profile, |S21| and delay. The TDR uses a 50 ps 10–90 % Gaussian step. Delay is the
difference between the 50 % crossings of the step responses at S21 and at the reference.

Like-for-like physics, declared before the run:

- **Conductors are lossless on both sides.** openEMS copper is PEC, because resolving skin depth in
  FDTD is out of reach. In the ladder, conductor R and skin R are zero. Conductor loss is
  covered by golden checks 7–11.
- **The dielectric is identical on both sides.** openEMS gets the pipeline's own nine Debye poles
  per laminate layer: ε(ω) = ε∞ + Σ Δε_p/(1 + jω/r_p), with Δε_p = εr·tan δ·w_p and ε∞ chosen so
  that Re ε(1 GHz) = εr. These are the same weights and rates as `causalLossPoles()`.
- Both sides use the same stackup, mask slab and copper geometry, and the same port pads and
  50 Ω references. Any difference left is then 3D field physics that the 2.5D model leaves out,
  plus the solver error budget below.

### Tolerances (committed before the first openEMS run)

| Quantity | Tolerance | Justification |
|---|---|---|
| Z0 (TDR plateau on a straight run, at least 3 rise lengths from a port or via) | ±3 % | Pipeline BEM ≤ 0.3 % (golden checks 2–5). openEMS staircase and mesh error with ≥ 3 cells across the trace width and graded z cells is about 1–2 % (openEMS MSL tutorials; Taflove & Hagness, *Computational Electrodynamics*, 3rd ed., §4.6). TDR smoothing on a plateau longer than 3 rise lengths is under 0.5 %. |
| Delay (S21 step, 50 % crossing) | ±2 % | Yee numerical dispersion at ≥ 20 cells per wavelength at 5 GHz is under 0.5 % phase velocity (Taflove & Hagness §4.6). Port reference planes are within one cell, under 0.3 % of a 20 mm route. Both sides use the same dielectric. Ladder phase error is under 0.3 % (golden check 21). |
| \|S21\| (dB), 10 MHz – 3 GHz | ±0.5 dB | Lossless conductors on both sides. Lumped-port parasitics (about 0.1–0.2 nH of vertical port current path) give under 0.1 dB of mismatch ripple at 3 GHz. Microstrip radiation over a short top-layer run is under 0.1 dB below 3 GHz. The rest of the 0.5 dB is margin for mesh error. 3–5 GHz is reported, with no tolerance. |

A failed tolerance is a finding, not a reason to change the tolerance. Each difference is tied
back to a row of the coverage table.

### Results

Results are added here after the runs. They are not part of this commit.
