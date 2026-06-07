import { describe, it, expect } from 'vitest'
import { parseApiError } from './useApiError'

function makeRes(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('parseApiError', () => {
  it('retourne le message string du backend', async () => {
    const res = makeRes({ statusCode: 400, message: 'Champ requis' })
    expect(await parseApiError(res)).toBe('Champ requis')
  })

  it('joint les messages tableau avec ·', async () => {
    const res = makeRes({ message: ['email invalide', 'mdp trop court'] })
    expect(await parseApiError(res)).toBe('email invalide · mdp trop court')
  })

  it("retombe sur le champ error si message absent", async () => {
    const res = makeRes({ error: 'NOT_FOUND' })
    expect(await parseApiError(res)).toBe('NOT_FOUND')
  })

  it('retourne le fallback si corps non-JSON', async () => {
    const res = new Response('not json')
    expect(await parseApiError(res, 'oops')).toBe('oops')
  })
})
