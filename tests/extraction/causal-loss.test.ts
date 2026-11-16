import test from 'node:test'
import assert from 'node:assert/strict'
import { causalLossPoles, causalLossResponse, crossoverPoles, skinCrossover, solveCrossSection } from '../../src/extraction'
import { filamentImpedance } from '../support/golden-checks'

test('positive-real loss quadrature is bounded over the DDR edge band', () => {
  assert.ok(causalLossPoles().every(pole => pole.rate > 0 && pole.skin > 0 && pole.dielectric > 0))
  for (let i = 0; i <= 100; i++) {
    const frequency = 1e7 * 500 ** (i / 100)
    const response = causalLossResponse(frequency)
    assert.ok(Math.abs(response.skinReal / Math.sqrt(frequency) - 1) < .05)
    assert.ok(Math.abs(response.dielectricReal / (2 * Math.PI * frequency) - 1) < .06)
    assert.ok(response.skinImaginary > 0 && response.dielectricCapacitance > 0)
  }
})

test('golden invariants: causal-loss poles are stable and every Foster branch is passive', () => {
  // Foster RL/RC branches with positive elements are positive-real (Guillemin, Synthesis of Passive Networks, ch. 4):
  // every pole s = -rate lies in the left half-plane and every weight is positive, so Re Z(jw) >= 0 and
  // Re Y(jw) >= 0 at every frequency. Checked exactly on the element values and numerically from 1 Hz to 1 THz.
  const poles = causalLossPoles()
  assert.ok(poles.every(pole => Number.isFinite(pole.rate) && -pole.rate < 0), 'every pole is real and negative')
  assert.ok(poles.every(pole => pole.skin > 0 && pole.skin / pole.rate > 0 && pole.dielectric > 0), 'every R, L, G and C element is positive')
  for (let i = 0; i <= 240; i++) {
    const response = causalLossResponse(10 ** (i / 20))
    assert.ok(response.skinReal >= 0 && response.dielectricReal >= 0 && response.dielectricCapacitance > 0, `passive at ${10 ** (i / 20)} Hz`)
  }
  // The DC-to-skin crossover shift keeps the same form for any shift >= 0: rate + shift > 0, skin rate/(rate + shift) > 0.
  for (const shift of [1e6, 1e8, 1e10]) {
    assert.ok(crossoverPoles(poles, shift).every(pole => -pole.rate < 0 && pole.skin > 0), `shift ${shift}: every element is positive`)
    for (let i = 0; i <= 240; i++) assert.ok(causalLossResponse(10 ** (i / 20), shift).skinReal >= 0, `shift ${shift}: passive at ${10 ** (i / 20)} Hz`)
  }
})

// Tolerance 5% over 10 MHz–5 GHz for both checks below: the band and bound the magnitude test above already uses.
test('golden stage 3: causal skin loss has the good-conductor 45 degree phase', () => {
  // A good conductor's surface impedance is Zs = (1 + j) Rs (Ramo, Whinnery & Van Duzer, Fields and Waves,
  // section 5.4), so the internal reactance equals the skin resistance.
  for (let i = 0; i <= 50; i++) {
    const response = causalLossResponse(1e7 * 500 ** (i / 50))
    assert.ok(Math.abs(response.skinImaginary / response.skinReal - 1) <= .05, `X/R ${response.skinImaginary / response.skinReal}`)
  }
})

test('golden stage 3: causal dielectric loss obeys the Kramers–Kronig slope locally', () => {
  // A constant loss tangent over a wide band forces dC/d ln(w) = -(2/pi) G/w by Kramers–Kronig (Djordjevic, Biljic,
  // Likar-Smiljanic & Sarkar, IEEE Trans. EMC 43 (2001) 662–667).
  for (let i = 0; i <= 50; i++) {
    const frequency = 1e7 * 500 ** (i / 50)
    const response = causalLossResponse(frequency)
    const slope = (causalLossResponse(frequency * 1.01).dielectricCapacitance - response.dielectricCapacitance) / Math.log(1.01)
    const expected = -2 / Math.PI * response.dielectricReal / (2 * Math.PI * frequency)
    assert.ok(Math.abs(slope / expected - 1) <= .05, `${frequency} Hz: ${slope} vs ${expected}`)
  }
})

test('golden stage 3: simulated conductor resistance follows a filament reference from 10 MHz to 5 GHz', () => {
  // The ladder's series resistance per metre is R_dc + S Re[z(jw + shift) - z(shift)] (route-energy.ts skinEnergy,
  // shift = skinCrossover). Reference: an independent filament (PEEC) solve of the same rectangular strip between copper
  // planes (filamentImpedance; Weeks et al., IBM J. Res. Dev. 1979), which resolves DC, the crossover and skin effect
  // with no Wheeler or interpolation input. Two centred striplines, er 4.1: 0.1 x 0.0152 mm in b = 0.2152 mm (the DDR3
  // board's inner trace) and 1 oz 0.2 x 0.035 mm in b = 0.5 mm. Tolerance 10% at every frequency. It was set while
  // choosing the crossover form, from the closed form sqrt(R_dc^2 + 2 j S^2 f) against this reference (worst -8.7%),
  // so it is not independent of that comparison; it is the bound the ladder's own AC check (route-ladder.test.tsx) uses.
  // Error sources: one crossover shape for strip and plane loss together; the filament reference under-resolves the
  // skin depth above 1 GHz and converges from below (~1% at 5 GHz on the thin strip, a few % on the 1 oz strip,
  // between 40 x 16 and 60 x 24 cells); the Foster fit adds <= 0.8%. The plain sum R_dc + S z(s) is 37–49% high at
  // 10–50 MHz on these strips.
  const frequencies = [1e7, 2e7, 5e7, 1e8, 2e8, 5e8, 1e9, 2e9, 5e9]
  const rows: Record<string, number | string>[] = []
  const failures: string[] = []
  for (const [label, w, t, b] of [['0.1 x 0.0152 mm, b 0.2152', .1, .0152, .2152], ['0.2 x 0.035 mm, b 0.5', .2, .035, .5]] as const) {
    const line = solveCrossSection({ conductors: [{ id: 's', xMm: 0, zMm: (b - t) / 2, widthMm: w, thicknessMm: t }], planes: [{ zMm: 0 }, { zMm: b }], dielectrics: [{ zMm: 0, thicknessMm: b, er: 4.1, lossTangent: 0 }] })
    const dc = line.dcResistance[0][0]
    const skin = line.skinResistance[0][0]
    const reference = filamentImpedance({ widthM: w * 1e-3, thicknessM: t * 1e-3, bottomM: (b - t) / 2 * 1e-3, spacingM: b * 1e-3, conductivity: 5.8e7 }, frequencies)
    for (const { frequency, resistance } of reference) {
      const realized = dc + skin * causalLossResponse(frequency, skinCrossover(dc, skin)).skinReal
      const error = realized / resistance - 1
      rows.push({ strip: label, frequencyHz: frequency, referenceOhmPerM: +resistance.toFixed(3), simulatedOhmPerM: +realized.toFixed(3), errorPercent: +(100 * error).toFixed(2) })
      if (!(Math.abs(error) <= .1)) failures.push(`${label} at ${frequency} Hz: ${realized} vs ${resistance}`)
    }
  }
  console.table(rows)
  assert.deepEqual(failures, [])
})
