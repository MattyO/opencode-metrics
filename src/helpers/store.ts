import type { StoreApi } from 'zustand/vanilla'

type WithSelectors<S extends StoreApi<unknown>> = S & {
  use: { [K in keyof S['getState']]: S['getState'][K] }
}

/**
 * Wrap a Zustand vanilla store to expose selector functions under `.use.<key>`.
 * @param store     - A vanilla Zustand store (created with `createStore`)
 * @param whitelist - Keys to expose as selector functions; omitted keys are skipped
 * @returns The store with a `use` namespace attached
 */
export function createSelectors<S extends StoreApi<unknown>>(
  store: S,
  whitelist: (keyof S['getState'])[],
): WithSelectors<S> {
  const storeWithSelectors = store as WithSelectors<S>
  storeWithSelectors.use = {} as WithSelectors<S>['use']

  for (const key of whitelist) {
    ;(storeWithSelectors.use as Record<string, (...args: unknown[]) => unknown>)[String(key)] = (...args: unknown[]) =>
      (store.getState()[key] as (...args: unknown[]) => unknown)(...args)
  }

  return storeWithSelectors
}
