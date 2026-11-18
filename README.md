## What is it?

Signal-integrity tools for tscircuit boards.

## How to use it?

The stack retains Circuit JSON validation, physical stackup and stimulus helpers, IBIS asset loading and the ngspice adapter.
Declare transient channels in Circuit JSON. Signal preparation validates endpoint topology, selected IBIS capabilities, timing and PRBS patterns.

## General workflow

```mermaid
flowchart LR
  input["Channel declarations"] --> result["Signal checks and pin selection"]
```

```mermaid
stateDiagram-v2
  [*] --> Ready
  Ready --> Complete: Signal checks and pin selection
  Ready --> Failed: invalid input
  Complete --> [*]
  Failed --> [*]
```
