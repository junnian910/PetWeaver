import { expect, it } from 'vitest'
import { redact } from '../src/main/core/redact.js'

it('redacts nested secret-like values', () => expect(redact({apiKey:'abc',nested:{token:'x',roomId:'1'}})).toEqual({apiKey:'[REDACTED]',nested:{token:'[REDACTED]',roomId:'1'}}))
