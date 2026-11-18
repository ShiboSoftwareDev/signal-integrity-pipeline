# Kisi development validation

Compare `solveCrossSection` with [Kisi 0.3.3](https://github.com/riehlies/kisi/releases/tag/v0.3.3)'s independent Forstén field solver. Kisi is an external development tool, obtained from its upstream release and checked against its SHA-256. It is not bundled with the library.

## Fixed comparison protocol

Use three uniform, vendor-free microstrip coupons: single-ended width/height ratios 0.5 and 1, and a symmetric differential pair with width/height 1 and edge-gap/height 0.5. All have a 1 mm substrate, εr 4, 35 µm copper, no soldermask, an uninterrupted ground plane, and 20 mm of straight trace. There are no pads, vias, stubs, devices, or automatic routes. The field solver's infinite-plane cross-section and the centre of each KiCad coupon represent the same geometry.

The maximum relative difference is **3% in characteristic impedance** and **2% in propagation delay**. These engineering comparison thresholds allow for the two independent field discretizations and finite interface extents; they are not statements of physical accuracy. They are fixed before comparing the pipeline with these fixtures. Do not widen them to accommodate a failed result.

Compare the single-ended mode for each isolated trace and the odd/differential mode for the pair. Also compare the pair's even/common propagation delay. Differential impedance is twice the odd-mode impedance. Delay is per-unit-length √(LC) times the 20 mm coupon length; it is not loaded step delay or eye alignment.

A live result must come from the pinned CLI, cover 100% of the target length with its field solver, contain one uniform section of the expected length, and contain finite positive numerical results. A missing CLI, timeout, nonzero process exit, malformed result, or formula fallback is a validation failure. The ordinary offline suite explicitly skips the live check unless requested.

## Scope

This checks the quasi-TEM cross-section fields. It does not qualify route admission, PCB connectivity/short detection, losses, SPICE export fitting, IBIS, or eye measurements. The earlier [three-board experiment](https://github.com/ShiboSoftwareDev/kisi-signal-integrity-benchmark) records separate timing/export disagreements and an invalid shorted board; its eye results are not treated as golden physical references.

The existing analytical known-answer checks remain useful alongside this independent numerical comparison. Kisi's own models are approximations, so disagreement requires investigation rather than assuming either tool is correct.
