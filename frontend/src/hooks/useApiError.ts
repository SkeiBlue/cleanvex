/**
 * Extrait un message lisible depuis une Response d'API.
 * Le backend renvoie { statusCode, error, message, timestamp, path }
 * message peut être string ou string[].
 */
export async function parseApiError(res: Response, fallback = 'Une erreur est survenue.'): Promise<string> {
  try {
    const body = await res.json()
    if (body && typeof body.message === 'string') return body.message
    if (body && Array.isArray(body.message)) return body.message.join(' · ')
    if (body && typeof body.error === 'string') return body.error
  } catch {
    // corps non-JSON
  }
  return fallback
}
