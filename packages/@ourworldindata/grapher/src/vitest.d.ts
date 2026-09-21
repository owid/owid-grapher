// jest-dom 7 only knows how to extend vitest <= 4: its `/vitest` entrypoint
// augments `Assertion<T>`, but vitest 5 renamed that to `Assertion<R, T>`, so
// the augmentation silently stops merging. Extend vitest 5's dedicated
// `Matchers` extension point instead.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"

declare module "vitest" {
    // oxlint-disable-next-line typescript/no-empty-interface
    interface Matchers<
        R extends void | Promise<void> = void | Promise<void>,
        T = unknown,
        // oxlint-disable-next-line typescript/no-empty-object-type
    > extends TestingLibraryMatchers<unknown, R> {}
}
