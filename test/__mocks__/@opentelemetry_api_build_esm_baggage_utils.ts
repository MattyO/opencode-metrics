// Mock for @opentelemetry/api/build/esm/baggage/utils
export function createContextStorage() { return { active: () => null } }
export function createBaggage() { return { keys: () => [], getAllEntries: () => [], set: () => ({} as any), remove: () => ({} as any), clear: () => ({} as any) } }
export function baggageEntryMetadataFromString() { return null }
