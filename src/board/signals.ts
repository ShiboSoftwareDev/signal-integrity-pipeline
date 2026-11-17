export type { SimulationPcbDriverReceiverChannel, SimulationPcbTransientChannelSimulation, SignalEndpoint } from 'circuit-json'
import type { SimulationPcbDriverReceiverChannel, SimulationSignalWaveformResult, SimulationPcbTransientChannelResult } from 'circuit-json'
export type SignalResult = SimulationSignalWaveformResult | SimulationPcbTransientChannelResult

/** Constant literal patterns and disabled drivers record quiet-channel idle voltages. */
export function isQuiet(signal: SimulationPcbDriverReceiverChannel): boolean {
  return !!signal.driver_disabled || /^(?:0+|1+)$/.test(signal.pattern)
}
