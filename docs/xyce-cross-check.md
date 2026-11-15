# Xyce cross-check of the routed decks

The routed pipeline writes one ngspice deck per block. This check runs the **same deck** in a second,
independent circuit simulator, Sandia's Xyce, and asks whether the node waveforms agree. Agreement
means the results are not an artefact of ngspice's numerics: its time-step control, its Newton
iteration, its KLU settings or its handling of B sources and coupled inductors.

It does not test the physics. Both simulators solve the same equations, so a wrong extraction or a
wrong buffer model gives the same wrong answer in both. The physics checks are in
[golden-checks.md](golden-checks.md).

## Tolerances (fixed before any run)

| Quantity | Tolerance | Applies to |
|---|---|---|
| max \|V_ngspice − V_Xyce\| | ≤ 10 mV | every saved node, over the whole run |
| 50 % crossing times | ≤ 5 ps, and the same number of crossings | every node whose ngspice swing is ≥ 0.2 V |
| End time | both reach the deck's stop time | the run |

How the numbers are measured (`scripts/xyce-cross-check.ts`):

- Each engine keeps its own adaptive time points. ΔV is taken both ways: ngspice samples against
  Xyce's linear interpolant, and Xyce samples against ngspice's.
- The 50 % level is the midpoint of the node's ngspice range. A crossing is counted once per excursion
  beyond ±10 % of the swing (hysteresis), so noise near the level is not counted.
- Crossings are paired in order.

Why these numbers:

1. **Time-step error.** Both decks ask for reltol = 1e-4 and vntol = 1e-6 V, with Gear (BDF) order ≤ 2.
   Each engine therefore holds its local truncation error near reltol·|V| + vntol ≈ 0.15 mV per step
   on a 1.5 V signal. The estimators and step choices differ, so the errors are not the same. In
   this damped (lossy, terminated) network the global error stays a small multiple of the per-step
   error, not a sum over every step. 10 mV is about 65 times the per-step target and 0.7 % of a 1.5 V
   swing. A difference above it is not step-size noise.
2. **Newton tolerance.** Xyce gets the same reltol, vntol (as its update abstol) and current abstol
   (as its residual tolerance), with deltaxtol = 1. That keeps the Newton error at the same
   ≤ 0.15 mV scale.
3. **Comparison interpolation.** Linear interpolation between time points h apart is off by at most
   h²/8·|V''|. Take a 1.5 V edge with a 100 ps rise, so |V''| ≈ 6e-4 V/ps². At h = 2 ps the error is
   0.3 mV; at h = 5 ps it is 1.9 mV. Both engines use steps near 1 ps on edges.
4. **Translation.** Every rewrite in `scripts/xyce-deck.ts` is an exact identity (table below). It
   adds no error of its own.
5. **Timing.** Δt ≈ ΔV / slope. With ΔV ≤ 10 mV and slopes of at least 2 mV/ps at the 50 % point,
   Δt ≤ 5 ps. Slopes are about 9 mV/ps for a 1.5 V, 100 ps edge.

A failure is a finding. The tolerances are never widened to make a run pass.

## Translation (`scripts/xyce-deck.ts`)

| ngspice construct | Xyce form | Exact? |
|---|---|---|
| Title line, `R C V E F G X`, `.subckt`/`.ends`, `PWL(...)` sources, `.tran step stop 0 maxstep` | unchanged | yes |
| `.options klu reltol abstol vntol method=gear maxord=2 pivrel` | `.options timeint method=gear maxord=2 reltol abstol=vntol`; `.options nonlin` and `nonlin-tran` with `reltol abstol=vntol rhstol=abstol deltaxtol=1`; `.options linsol type=klu` | `pivrel` has no Xyce KLU option and is dropped. Xyce has one weighted update norm, so vntol is its abstol and the ngspice current abstol becomes the residual tolerance. |
| `B… I={…pwl(min(max(x,lo),hi), x0,y0, …)}` | `pwl(` → `table(` | yes, when lo ≥ x0 and hi ≤ xN: Xyce's grammar has no `pwl()`, and `table()` holds its end values where ngspice extrapolates. The translator rejects any pwl whose clamp leaves its table, or any pwl that is not clamped. |
| `.save v(…) i(v.xibis0.…)` | `.print tran format=csv precision=12 v(…)` | Xyce's `.SAVE` writes an operating point. The branch-current saves are dropped. |
| `K… La Lb k` | default (`--mutual vcvs`): the K lines are dropped. Each coupled inductor becomes its self inductor followed by one VCVS per mutual term: V_i = L_i dI_i/dt + Σ_j (M_ij/L_j)·V(L_j). `--mutual native` keeps the K lines. | yes, an algebraic identity. Xyce merges every K-connected inductor set into one mutual-inductor device with a dense n×n stamp (`N_IO_CircuitBlock.C`, `N_DEV_MutIndLin.C`). On the routed ladders that set spans every coupled cell. |

The translator fails on any other control line or element letter, so a new deck construct cannot
pass through untranslated.

## Building Xyce (macOS, Apple Silicon, no sudo)

There is no Homebrew formula and no osx-arm64 Trilinos on conda-forge, so the check builds
Trilinos 16.1.0 and Xyce 7.10.0 from their release tarballs, serially, with Apple clang and Homebrew
dependencies. Fortran and MPI are not used.

```sh
brew install cmake suitesparse openblas fftw flex bison
PREFIX=~/.local/xyce JOBS=6 scripts/xyce-build.sh   # heavy: run it through the shared job lock
```

The build uses Xyce's own `cmake/trilinos/trilinos-base.cmake` preset, with OpenBLAS for
BLAS/LAPACK and AMD from SuiteSparse.

## Running

```sh
# (a) committed CI-sized deck; ngspice and Xyce both run
SI_NATIVE_TESTS=1 XYCE=~/.local/xyce/xyce/bin/Xyce node --import tsx --test tests/tooling/xyce-cross-check.test.ts
# any deck: writes xyce.cir, waveform.csv and report.json into <outdir>
XYCE=~/.local/xyce/xyce/bin/Xyce tsx scripts/xyce-cross-check.ts <simulation.cir> <outdir>
# reuse an existing pipeline capture as the ngspice side
tsx scripts/xyce-cross-check.ts <simulation.cir> <outdir> --capture capture.json --evidence evidence.json
```

## Results

Not yet run.
