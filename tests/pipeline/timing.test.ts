import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { defaultDurationSeconds } from '../../src/pipeline/timing'
import type { SimulationPcbDriverReceiverChannel } from '../../src/board'

/** Minimal resolved intent for pure timing arithmetic; no hand-authored electrical circuit. */
const signal = (pattern: string, rate: number, offset: number = 0): SimulationPcbDriverReceiverChannel => ({ type: 'simulation_pcb_driver_receiver_channel', simulation_pcb_driver_receiver_channel_id: 's', simulation_pcb_transient_channel_simulation_id: 'b', name: 'DATA',
  driver: { source_port_id: 'tx' }, receivers: [{ source_port_id: 'rx' }], pattern, seed: 127, bit_rate_bps: rate, offset_ms: offset * 1000 })

test('automatic capture adds 128 unit intervals at the slowest switching bit rate after startup', () => {
  assert.equal(defaultDurationSeconds([signal('clock', 1)]), 144)
  assert.equal(defaultDurationSeconds([signal('prbs31', 2, 3), signal('00110', 1)]), 144)
  assert.equal(defaultDurationSeconds([signal('clock', 2, 3)]), 75)
  for (const pattern of ['0', '1', '000', '111']) assert.equal(defaultDurationSeconds([signal(pattern, 2, 100)]), 16)
  assert.equal(defaultDurationSeconds([{ ...signal('prbs31', 2, 100), driver_disabled: true }]), 16)
})
