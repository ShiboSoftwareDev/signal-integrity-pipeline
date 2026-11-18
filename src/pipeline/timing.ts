import { isQuiet, type SimulationPcbDriverReceiverChannel } from '../board'

// Allow each switching channel 16 bits to settle after it starts.
const startupBits = 16
// Record another 128 bits for the eye after startup.
const eyeBits = 128
// Quiet-only blocks need just 32 bits to record the steady response.
const quietBits = 32

/**
 * A unit interval is one bit time in seconds (1 / bit_rate_bps).
 * Start the eye capture after every switching channel has had time to settle. Use the longest
 * switching bit time for the eye, or the longest bit time overall for a quiet block.
 */
export function defaultDurationSeconds(signals: SimulationPcbDriverReceiverChannel[]): number {
  const switching = signals.filter(signal => !isQuiet(signal))
  if (!switching.length) {
    const unitIntervalSeconds = Math.max(...signals.map(signal => 1 / signal.bit_rate_bps))
    return quietBits * unitIntervalSeconds
  }
  const unitIntervalSeconds = Math.max(...switching.map(signal => 1 / signal.bit_rate_bps))
  const startupSeconds = Math.max(...switching.map(signal => signal.offset_ms / 1000 + startupBits / signal.bit_rate_bps))
  return startupSeconds + eyeBits * unitIntervalSeconds
}
