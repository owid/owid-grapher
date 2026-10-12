// jest-dom 7 only knows how to extend vitest <= 4: its `/vitest` entrypoint
// augments `Assertion<T>`, but vitest 5 changed that interface to
// `Assertion<R, T>`, so the augmentation silently stops merging and all
// jest-dom matchers disappear from the type of `expect(...)`. Extend vitest 5's
// dedicated `Matchers` extension point ourselves instead.
//
// This file has to be part of every project that uses jest-dom matchers, so it
// is listed in the `include` of those projects' tsconfigs.
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"

declare module "vitest" {
    // oxlint-disable-next-line typescript/no-empty-interface
    interface Matchers<
        R extends void | Promise<void> = void | Promise<void>,
        T = unknown,
        // oxlint-disable-next-line typescript/no-empty-object-type
    > extends TestingLibraryMatchers<unknown, R> {}
}
