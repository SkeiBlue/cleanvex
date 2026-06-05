// PostHog disabled in V1 — enabled in V2 (Decision #88)
export function initAnalytics(): void {}
export function identifyUser(_userId: string): void {}
export function resetAnalytics(): void {}
export function trackEvent(_event: string, _properties?: Record<string, unknown>): void {}
