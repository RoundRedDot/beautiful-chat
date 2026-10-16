/** Inspect initialized Metro exports without requiring modules or invoking getters. */
export function initializedRouter(modules) {
  for (const module of modules.values()) {
    if (!module.isInitialized) continue;
    const exported = module.publicModule?.exports;
    if (!exported || (typeof exported !== 'object' && typeof exported !== 'function')) continue;
    const values = [exported, ...Object.values(Object.getOwnPropertyDescriptors(exported)).map(descriptor => descriptor.value)];
    const router = values.find(value => value && (typeof value === 'object' || typeof value === 'function') &&
      typeof Object.getOwnPropertyDescriptor(value, 'push')?.value === 'function' &&
      typeof Object.getOwnPropertyDescriptor(value, 'canGoBack')?.value === 'function');
    if (router) return router;
  }
  return null;
}
