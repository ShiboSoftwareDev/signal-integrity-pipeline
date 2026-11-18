import type { CrossSection } from '../../src/extraction'

/** Uniform, vendor-free reference coupons; dimensions are millimetres. */
export interface KisiCoupon {
  name: string
  widthMm: number
  gapMm?: number
}

export const kisiCoupons: readonly KisiCoupon[] = [
  { name: 'narrow-microstrip', widthMm: 0.5 },
  { name: 'wide-microstrip', widthMm: 1 },
  { name: 'differential-microstrip', widthMm: 1, gapMm: 0.5 },
]

export const couponLengthMm = 20

/** The exact field problem represented by the straight KiCad fixture below. */
export function couponSection(coupon: KisiCoupon): CrossSection {
  const separationMm = coupon.widthMm + (coupon.gapMm ?? 0)
  const centresMm = coupon.gapMm === undefined ? [0] : [-separationMm / 2, separationMm / 2]
  return {
    conductors: centresMm.map((xMm, index) => ({ id: `signal${index}`, xMm, zMm: 1, widthMm: coupon.widthMm, thicknessMm: 0.035 })),
    planes: [{ zMm: 0 }],
    dielectrics: [{ zMm: 0, thicknessMm: 1, er: 4, lossTangent: 0 }],
  }
}

/** Kisi's selected net; the pair naming also identifies its negative leg. */
export function couponNet(coupon: KisiCoupon): string {
  return coupon.gapMm === undefined ? 'DATA' : 'DATA_P'
}

/** Minimal KiCad test coupon, not a general Circuit JSON exporter or routed board. */
export function couponBoard(coupon: KisiCoupon): string {
  const section = couponSection(coupon)
  const names = coupon.gapMm === undefined ? ['DATA'] : ['DATA_P', 'DATA_N']
  const nets = names.map((name, index) => `(net ${index + 2} "${name}")`).join('\n')
  const tracks = section.conductors.map((conductor, index) => `(segment (start 5 ${10 + conductor.xMm}) (end ${5 + couponLengthMm} ${10 + conductor.xMm}) (width ${conductor.widthMm}) (layer "F.Cu") (net ${index + 2}))`).join('\n')
  return `(kicad_pcb (version 20241229) (generator "kisi_validation_coupon")
(general (thickness 1.07))
(layers (0 "F.Cu" signal) (2 "B.Cu" signal) (25 "Edge.Cuts" user))
(setup (stackup
  (layer "F.Cu" (type "copper") (thickness 0.035))
  (layer "dielectric 1" (type "core") (thickness 1) (epsilon_r 4) (loss_tangent 0))
  (layer "B.Cu" (type "copper") (thickness 0.035))))
(net 0 "") (net 1 "GND")
${nets}
${tracks}
(zone (net 1) (net_name "GND") (layer "B.Cu") (hatch edge 0.5)
  (connect_pads (clearance 0)) (min_thickness 0.001) (filled_areas_thickness no)
  (fill yes (thermal_gap 0.1) (thermal_bridge_width 0.1))
  (polygon (pts (xy 0 0) (xy 30 0) (xy 30 20) (xy 0 20)))
  (filled_polygon (layer "B.Cu") (pts (xy 0 0) (xy 30 0) (xy 30 20) (xy 0 20))))
(gr_rect (start 0 0) (end 30 20) (stroke (width 0.05) (type default)) (fill none) (layer "Edge.Cuts")))
`
}

/** Declare only the reference target; no profile or IBIS end model participates. */
export function couponConfig(coupon: KisiCoupon): string {
  return JSON.stringify({
    kisi_config: 1,
    net_classes: { Reference: { nets: coupon.gapMm === undefined ? ['DATA'] : ['DATA_P', 'DATA_N'], target_ohm: coupon.gapMm === undefined ? 50 : 100, diff: coupon.gapMm !== undefined } },
  }, null, 2)
}
