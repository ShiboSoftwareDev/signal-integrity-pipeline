import test from 'node:test'
import assert from 'node:assert/strict'
import { solveCrossSection } from '../../src/extraction'
import { couponLengthMm, couponNet, couponSection, kisiCoupons } from './kisi-fixtures'
import { kisiReportSchema, runKisi } from './kisi'

// Protocol and tolerances were committed before the first pipeline/Kisi comparison.
const impedanceTolerance = 0.03
const delayTolerance = 0.02

/** Reject nonphysical numbers and report both tools' results alongside their relative difference. */
function compareMetric({ label, pipeline, kisi, tolerance }: { label: string; pipeline: number; kisi: number; tolerance: number }): void {
  assert.ok(Number.isFinite(pipeline) && pipeline > 0, `${label}: invalid pipeline result ${pipeline}`)
  assert.ok(Number.isFinite(kisi) && kisi > 0, `${label}: invalid Kisi result ${kisi}`)
  const difference = Math.abs(pipeline / kisi - 1)
  console.log(`${label.padEnd(40)} pipeline=${pipeline.toFixed(3)} kisi=${kisi.toFixed(3)} difference=${(difference * 100).toFixed(3)}%`)
  assert.ok(difference <= tolerance, `${label}: ${(difference * 100).toFixed(3)}% exceeds ${tolerance * 100}%`)
}

for (const coupon of kisiCoupons) {
  test(`Kisi field solver agrees on ${coupon.name}`, { skip: process.env.SI_KISI_TESTS !== '1' ? 'Run pnpm kisi:setup && pnpm test:kisi for live independent field validation' : false, timeout: 150_000 }, async () => {
    const started = performance.now()
    const report = await runKisi(coupon)
    assert.equal(report.net, couponNet(coupon))
    assert.equal(report.length_mm, couponLengthMm)
    assert.equal(report.segments[0].len_mm, couponLengthMm)
    assert.equal(report.differential, coupon.gapMm !== undefined)
    const section = solveCrossSection(couponSection(coupon))
    const oddInductance = section.L[0][0] - (section.L[0][1] ?? 0)
    const oddCapacitance = section.C[0][0] - (section.C[0][1] ?? 0)
    const factor = coupon.gapMm === undefined ? 1 : 2
    compareMetric({ label: `${coupon.name} impedance (ohm)`, pipeline: factor * Math.sqrt(oddInductance / oddCapacitance), kisi: report.impedance.mean, tolerance: impedanceTolerance })
    compareMetric({ label: `${coupon.name} delay (ps)`, pipeline: Math.sqrt(oddInductance * oddCapacitance) * couponLengthMm / 1000 * 1e12, kisi: report.delay_ps, tolerance: delayTolerance })
    if (coupon.gapMm !== undefined) {
      assert.ok(report.mixed_mode, 'Expected independently solved odd and even modes')
      assert.equal(report.mixed_mode.delay_ps_diff, report.delay_ps)
      const evenInductance = section.L[0][0] + section.L[0][1]
      const evenCapacitance = section.C[0][0] + section.C[0][1]
      compareMetric({ label: 'differential-microstrip common delay (ps)', pipeline: Math.sqrt(evenInductance * evenCapacitance) * couponLengthMm / 1000 * 1e12, kisi: report.mixed_mode.delay_ps_common, tolerance: delayTolerance })
    } else assert.equal(report.mixed_mode, null)
    // Guard against a green result if a future CLI falls back to formulas or loses field coverage.
    assert.equal(kisiReportSchema.safeParse({ ...report, field_solver: { ...report.field_solver, cross_sections_field: 0 } }).success, false)
    assert.equal(kisiReportSchema.safeParse({ ...report, delay_ps: NaN }).success, false)
    console.log(`${coupon.name} duration=${((performance.now() - started) / 1000).toFixed(3)}s`)
  })
}
