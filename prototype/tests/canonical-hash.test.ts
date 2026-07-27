import { describe, expect, it } from 'vitest'
import {
  canonicalJson,
  sha256Canonical,
} from '../src/sim/canonical-hash'

describe('canonical SHA-256', () => {
  it('sorts object keys and matches the SHA-256 reference vector', () => {
    expect(canonicalJson({ z: 1, a: ['x', 2] })).toBe(
      '{"a":["x",2],"z":1}',
    )
    expect(sha256Canonical('abc')).toBe(
      '6cc43f858fbb763301637b5af970e2a46b46f461f27e5a0f41e009c59b827b25',
    )
    expect(sha256Canonical({ z: 1, a: 2 })).toBe(
      sha256Canonical({ a: 2, z: 1 }),
    )
  })
})
