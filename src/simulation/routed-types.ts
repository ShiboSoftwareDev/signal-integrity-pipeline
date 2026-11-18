import type { CircuitJson, CopperScope, LaneMapping } from '../board'
import type { CompiledBuffer, IbisSources } from '../buffers'
import type { RouteMaterials } from '../extraction'
import type { RunControls, SimulationModeling, SimulationPlan } from './types'

export interface RoutedCompileOptions {
  riseSeconds: number
  refinement: number
  durationSeconds: number
  stepSeconds: number
  panels?: number
  currentToleranceA?: number
  cellsPerRise?: number
  materials?: RouteMaterials
}
export interface RouteBindingsInput {
  circuitJson: CircuitJson
  scope: CopperScope
  mappings: LaneMapping[]
  modeling: SimulationModeling
  controls: Record<string, RunControls>
  ibisSources: IbisSources
  options: RoutedCompileOptions
  artifactPrefix: string
}
export type RouteBuffer = Pick<CompiledBuffer, 'name' | 'source' | 'spicePinMapping' | 'metadata' | 'warnings' | 'sourceEvidence'>
export interface RoutedBindings {
  circuitJson: CircuitJson
  scope: CopperScope
  mappings: LaneMapping[]
  plan: SimulationPlan
  nodeMap: Record<string, string>
  groundSourcePortId: string
  electricalLines: string[]
  models: RouteBuffer[]
}
