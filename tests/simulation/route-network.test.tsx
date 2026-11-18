import test from 'node:test'
import assert from 'node:assert/strict'
import { RoutedPipelineSolver } from '../../src/pipeline'
import { RouteNetworkSolver } from '../../src/simulation'
import { routedProblem } from '../support/routed-fixture'

test('network owns real ladder node samples, complete probe evidence and the executable deck', async (context) => {
  const input = await routedProblem(context)
  if (!input) return
  const port = { progress: (): void => undefined, runSolver: async (): Promise<never> => {
    throw new Error('network test must not run ngspice')
  } }
  const root = new RoutedPipelineSolver(input, port)
  root.solveUntilStage('RouteTransientSolver')
  const network = root.getSolver(RouteNetworkSolver.name)!
  const output = root.stageOutput('RouteNetworkSolver').value[0]
  assert.ok(network.iterations >= 3)
  assert.ok(output.evidence.cells)
  assert.ok(output.evidence.maximum_cell_delay_s)
  assert.ok(output.deck.includes('RBIAS'))
  // klu_refactor reuses the first transient pivots; the zero-diagonal skin multiport rows need KLU tol 0.1.
  assert.match(output.deck, /^\.options klu .* pivrel=0\.1$/m)
  assert.equal(output.probes.length, 3, 'two receivers and the existing rail monitor')
  assert.ok((output.evidence.warnings as string[]).some((warning) => warning.includes('candidate channel experiment')))
})
