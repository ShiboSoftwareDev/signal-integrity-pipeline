import { spawnSync } from 'node:child_process'
import { verifyKisi } from '../tests/support/kisi'

await verifyKisi()
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'tests/support/kisi.test.ts'], { stdio: 'inherit', env: { ...process.env, SI_KISI_TESTS: '1' } })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
