// Shared helpers for the golden known-answer checks (docs/golden-checks.md). They only measure;
// every expected value and tolerance lives beside its check, with its source.
import { accessSync, constants } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { delimiter, join } from 'node:path'
import type { TestContext } from 'node:test'
import { createNativeSolver } from '../../src/adapters'

/** Local vendor IBIS bytes are never committed: skip cleanly unless IBIS_MODEL_DIR holds `file`. */
export async function vendorText(context: TestContext, file: string): Promise<string | undefined> {
  if (!process.env.IBIS_MODEL_DIR) {
    context.skip(`Set IBIS_MODEL_DIR to local vendor ${file}; vendor bytes are not committed`)
    return
  }
  try {
    return await readFile(join(process.env.IBIS_MODEL_DIR, file), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    context.skip(`Local vendor ${file} is unavailable`)
    return
  }
}

/**
 * Eigenvalues of a real symmetric matrix, ascending, by cyclic Jacobi rotations
 * (Golub & Van Loan, Matrix Computations, 4th ed., §8.5.2). Independent of production linear algebra.
 */
export function symmetricEigenvalues(matrix: number[][]): number[] {
  const n = matrix.length
  const a = matrix.map(row => [...row])
  const scale = Math.max(...a.flat().map(Math.abs)) || 1
  for (let sweep = 0; sweep < 60; sweep++) {
    let largest = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) largest = Math.max(largest, Math.abs(a[p][q]))
    if (largest <= 1e-15 * scale) break
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) <= 1e-300) continue
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
      const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
      const c = 1 / Math.sqrt(t * t + 1)
      const s = t * c
      for (let k = 0; k < n; k++) {
        const kp = a[k][p]
        const kq = a[k][q]
        a[k][p] = c * kp - s * kq
        a[k][q] = s * kp + c * kq
      }
      for (let k = 0; k < n; k++) {
        const pk = a[p][k]
        const qk = a[q][k]
        a[p][k] = c * pk - s * qk
        a[q][k] = s * pk + c * qk
      }
    }
  }
  return a.map((row, i) => row[i]).sort((x, y) => x - y)
}

/** Measured energy-matrix facts: asymmetry, extreme eigenvalues and the strongest pairwise coupling. */
export interface EnergyFacts { asymmetry: number; minimumEigenvalue: number; maximumEigenvalue: number; coupling: number; pair: [number, number] }

/** Relative asymmetry, eigenvalue range and max |M_ij|/sqrt(M_ii M_jj) of a square matrix. */
export function energyFacts(matrix: number[][]): EnergyFacts {
  const scale = Math.max(...matrix.flat().map(Math.abs)) || 1
  let asymmetry = 0
  let coupling = 0
  let pair: [number, number] = [0, 0]
  for (let i = 0; i < matrix.length; i++) for (let j = 0; j < matrix.length; j++) {
    asymmetry = Math.max(asymmetry, Math.abs(matrix[i][j] - matrix[j][i]) / scale)
    if (i === j || !(matrix[i][i] > 0 && matrix[j][j] > 0)) continue
    const k = Math.abs(matrix[i][j]) / Math.sqrt(matrix[i][i] * matrix[j][j])
    if (k > coupling) {
      coupling = k
      pair = [i, j]
    }
  }
  const values = symmetricEigenvalues(matrix.map((row, i) => row.map((value, j) => (value + matrix[j][i]) / 2)))
  return { asymmetry, minimumEigenvalue: values[0], maximumEigenvalue: values.at(-1)!, coupling, pair }
}

/** Maxwell (grounded) capacitance sign facts: smallest diagonal, largest off-diagonal and smallest row sum relative to its diagonal. */
export function maxwellFacts(matrix: number[][]): { minimumDiagonal: number; maximumOffDiagonal: number; minimumRowSum: number } {
  let minimumDiagonal = Infinity
  let maximumOffDiagonal = -Infinity
  let minimumRowSum = Infinity
  for (const [i, row] of matrix.entries()) {
    minimumDiagonal = Math.min(minimumDiagonal, row[i])
    for (const [j, value] of row.entries()) if (i !== j) maximumOffDiagonal = Math.max(maximumOffDiagonal, value)
    minimumRowSum = Math.min(minimumRowSum, row.reduce((sum, value) => sum + value, 0) / row[i])
  }
  return { minimumDiagonal, maximumOffDiagonal: matrix.length > 1 ? maximumOffDiagonal : 0, minimumRowSum }
}

/** True only when an ngspice executable is on PATH; native golden checks skip cleanly otherwise. */
export function ngspiceAvailable(): boolean {
  return (process.env.PATH ?? '').split(delimiter).some(directory => {
    try {
      accessSync(join(directory, 'ngspice'), constants.X_OK)
      return true
    } catch {
      return false
    }
  })
}

/**
 * Run one small deck through the repo's sequential native adapter (OMP_NUM_THREADS=1) and return
 * its `wrdata golden.dat ...` rows: time (or sweep) first, then each saved vector.
 */
export async function runGoldenDeck(deck: string): Promise<number[][]> {
  const run = createNativeSolver({ timeoutMs: 120_000 })
  const output = await run({ solver: 'ngspice', files: { 'golden.cir': deck }, args: ['-n', '-b', 'golden.cir'], outputFiles: ['golden.dat'] })
  const diagnostic = (output.stdout + '\n' + output.stderr).split(/\r?\n/).find(line => /\b(?:error|fatal|aborted|timestep too small)\b/i.test(line))
  if (diagnostic) throw new Error(`ngspice: ${diagnostic}`)
  const text = output.files['golden.dat']
  if (!text) throw new Error('ngspice wrote no golden.dat')
  return text.trim().split('\n').slice(1).map(line => line.trim().split(/\s+/).map(Number))
}

/** Linear interpolation of column `column` at `time` over ascending time rows. */
export function valueAt(rows: number[][], column: number, time: number): number {
  if (time <= rows[0][0]) return rows[0][column]
  for (let i = 1; i < rows.length; i++) if (rows[i][0] >= time) {
    const span = rows[i][0] - rows[i - 1][0]
    return span ? rows[i - 1][column] + (rows[i][column] - rows[i - 1][column]) * (time - rows[i - 1][0]) / span : rows[i][column]
  }
  return rows.at(-1)![column]
}

/** First time after `after` at which column `column` crosses `level` (linear interpolation), or NaN. */
export function crossingTime(rows: number[][], column: number, level: number, after: number = -Infinity): number {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] <= after) continue
    const a = rows[i - 1][column] - level
    const b = rows[i][column] - level
    if (a === 0) return rows[i - 1][0]
    if (a * b < 0 || b === 0) return rows[i - 1][0] + (rows[i][0] - rows[i - 1][0]) * a / (a - b)
  }
  return NaN
}

/** One rectangular strip centred at x = 0 between perfectly flat copper reference planes at z = 0 and z = b (SI units). */
export interface FilamentStrip { widthM: number; thicknessM: number; bottomM: number; spacingM: number; conductivity: number }

/** Geometric cell edges on [0, length], `count` cells (even), finest at both ends with growth `ratio`. */
function gradedEdges(length: number, count: number, ratio: number): number[] {
  const half = Array.from({ length: count / 2 }, (_, i) => ratio ** i)
  const sizes = [...half, ...[...half].reverse()]
  const total = sizes.reduce((sum, size) => sum + size, 0)
  const edges = [0]
  for (const size of sizes) edges.push(edges.at(-1)! + size * length / total)
  return edges
}

/** Mean of ln r over one a x b rectangle against itself: Maxwell's geometric mean distance (Rosa & Grover, 1912). */
function selfLogDistance(a: number, b: number): number {
  return Math.log(Math.hypot(a, b)) - 25 / 12 + 2 / 3 * (b / a) * Math.atan(a / b) + 2 / 3 * (a / b) * Math.atan(b / a)
    - (a / b) ** 2 / 12 * Math.log(1 + (b / a) ** 2) - (b / a) ** 2 / 12 * Math.log(1 + (a / b) ** 2)
}

/**
 * Per-unit-length series impedance of `strip` by the filament (PEEC) method of Weeks, Wu, McAllister & Singh,
 * "Resistive and inductive skin effect in rectangular conductors", IBM J. Res. Dev. 23 (1979) 652–660. Independent of
 * the production solver: the strip is cut into graded uniform-current cells; cells couple through the exact
 * vector-potential Green function between two perfect planes, (mu0/4pi) ln[(cosh U - cos V+)/(cosh U - cos V-)],
 * U = pi dx/b, V± = pi (z ± z')/b (method of images summed in closed form); all cells see one longitudinal E and the
 * network is solved per frequency. Plane loss is then added from the surface current the solved cell currents induce on
 * each plane, K(x) = I sin(a)/(2b (cosh(pi dx/b) - cos a)), with surface impedance (1 + j) sqrt(pi f mu0/sigma) for
 * copper half-spaces: R_plane = Rs ∫|K|² dx / |I|², the same reactance. Returns R and L in ohm/m and H/m.
 */
export function filamentImpedance(strip: FilamentStrip, frequencies: number[], cells: { x: number; z: number; xRatio: number; zRatio: number } = { x: 40, z: 16, xRatio: 1.15, zRatio: 1.4 }): { frequency: number; resistance: number; inductance: number }[] {
  const mu0 = 1.25663706212e-6
  const b = strip.spacingM
  const p = Math.PI / b
  const xs = gradedEdges(strip.widthM, cells.x, cells.xRatio).map(x => x - strip.widthM / 2)
  const zs = gradedEdges(strip.thicknessM, cells.z, cells.zRatio).map(z => z + strip.bottomM)
  const parts = xs.slice(1).flatMap((x, i) => zs.slice(1).map((z, k) => ({ x: (x + xs[i]) / 2, z: (z + zs[k]) / 2, dx: x - xs[i], dz: z - zs[k] })))
  const n = parts.length
  // Smooth image part of the Green function: G + (mu0/2pi) ln r, finite as r -> 0.
  /** Image sum minus the free-space singularity, at two points. */
  const images = (a: { x: number; z: number }, c: { x: number; z: number }): number => {
    const r2 = (a.x - c.x) ** 2 + (a.z - c.z) ** 2
    const near = r2 < 1e-30 ? p * p / 2 : (Math.cosh(p * (a.x - c.x)) - Math.cos(p * (a.z - c.z))) / r2
    return mu0 / (4 * Math.PI) * (Math.log(Math.cosh(p * (a.x - c.x)) - Math.cos(p * (a.z + c.z))) - Math.log(near))
  }
  const gauss = [[-.8611363115940526, .3478548451374538], [-.3399810435848563, .6521451548625461], [.3399810435848563, .6521451548625461], [.8611363115940526, .3478548451374538]]
  const inductance = parts.map(() => new Float64Array(n))
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    const a = parts[i]
    const c = parts[j]
    let logDistance = 0
    if (i === j) logDistance = selfLogDistance(a.dx, a.dz)
    else if (Math.hypot(a.x - c.x, a.z - c.z) > 3 * Math.max(a.dx, a.dz, c.dx, c.dz)) logDistance = Math.log(Math.hypot(a.x - c.x, a.z - c.z))
    else for (const [u1, w1] of gauss) for (const [v1, w2] of gauss) for (const [u2, w3] of gauss) for (const [v2, w4] of gauss) {
      logDistance += w1 * w2 * w3 * w4 / 32 * Math.log((a.x + u1 * a.dx / 2 - c.x - u2 * c.dx / 2) ** 2 + (a.z + v1 * a.dz / 2 - c.z - v2 * c.dz / 2) ** 2)
    }
    inductance[i][j] = -mu0 / (2 * Math.PI) * logDistance + images(a, c)
    inductance[j][i] = inductance[i][j]
  }
  return frequencies.map(frequency => {
    const omega = 2 * Math.PI * frequency
    // Complex Gaussian elimination of (R + j omega L) I = 1 V/m; the matrix is complex symmetric with a dominant diagonal.
    const real = parts.map((part, i) => Float64Array.from({ length: n }, (_, j) => i === j ? 1 / (strip.conductivity * part.dx * part.dz) : 0))
    const imaginary = inductance.map(row => row.map(value => omega * value))
    const right = parts.map(() => [1, 0])
    for (let k = 0; k < n; k++) {
      const pivot = real[k][k] ** 2 + imaginary[k][k] ** 2
      for (let i = k + 1; i < n; i++) {
        const mr = (real[i][k] * real[k][k] + imaginary[i][k] * imaginary[k][k]) / pivot
        const mi = (imaginary[i][k] * real[k][k] - real[i][k] * imaginary[k][k]) / pivot
        for (let j = k; j < n; j++) {
          real[i][j] -= mr * real[k][j] - mi * imaginary[k][j]
          imaginary[i][j] -= mr * imaginary[k][j] + mi * real[k][j]
        }
        right[i] = [right[i][0] - (mr * right[k][0] - mi * right[k][1]), right[i][1] - (mr * right[k][1] + mi * right[k][0])]
      }
    }
    const current = parts.map(() => [0, 0])
    for (let k = n - 1; k >= 0; k--) {
      let [sr, si] = right[k]
      for (let j = k + 1; j < n; j++) {
        sr -= real[k][j] * current[j][0] - imaginary[k][j] * current[j][1]
        si -= real[k][j] * current[j][1] + imaginary[k][j] * current[j][0]
      }
      const pivot = real[k][k] ** 2 + imaginary[k][k] ** 2
      current[k] = [(sr * real[k][k] + si * imaginary[k][k]) / pivot, (si * real[k][k] - sr * imaginary[k][k]) / pivot]
    }
    const total = current.reduce(([r, i], [cr, ci]) => [r + cr, i + ci], [0, 0])
    const magnitude = total[0] ** 2 + total[1] ** 2
    let surface = 0
    const step = b / 300
    for (let x = -12 * b; x <= 12 * b; x += step) for (const top of [false, true]) {
      let kr = 0
      let ki = 0
      for (const [k, part] of parts.entries()) {
        const angle = p * (top ? b - part.z : part.z)
        const kernel = Math.sin(angle) / (2 * b * (Math.cosh(p * (x - part.x)) - Math.cos(angle)))
        kr += current[k][0] * kernel
        ki += current[k][1] * kernel
      }
      surface += (kr * kr + ki * ki) * step
    }
    const plane = Math.sqrt(Math.PI * frequency * mu0 / strip.conductivity) * surface / magnitude
    // Z = 1 / I_total for the unit driving field, plus the planes' (1 + j) R_plane surface impedance.
    return { frequency, resistance: total[0] / magnitude + plane, inductance: (-total[1] / magnitude + plane) / omega }
  })
}
