import type { CircuitJson } from './schema'
import type { CopperScope } from './geometry/scope'

export interface RouteSectionsInput {
  circuitJson: CircuitJson
  scope: CopperScope
  requiredSourcePortIds: string[]
  referenceSourcePortId: string
  artifactPrefix: string
}
