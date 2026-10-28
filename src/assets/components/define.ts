export type ElementRegistry = Pick<CustomElementRegistry, "get" | "define">;

/**
 * Registers a custom element exactly once.
 *
 * Two reasons for the guard:
 * 1. `customElements.define()` throws on a duplicate tag name.
 * 2. Pjax never re-executes head module scripts, but a re-imported module (or a
 *    duplicated chunk) would otherwise register twice.
 *
 * Returns `false` when the tag is already taken or the registry is unavailable
 * (for example when the module is imported in a Node test environment).
 */
export function defineElement(name: string, ctor: CustomElementConstructor, registry?: ElementRegistry): boolean {
  const target = registry ?? (globalThis as { customElements?: ElementRegistry }).customElements;

  if (!target || target.get(name)) {
    return false;
  }

  target.define(name, ctor);

  return true;
}
