import { expectTypeOf, it } from "vitest"
import type { GAEvent, RetiredEventCategory } from "./analyticsTypes.js"

// The names of the events whose action accepts any string. The test below
// expects there to be none. Events that have no action don't count. `E`
// defaults to `GAEvent` so that TypeScript checks each event on its own.
type FreeTextEvent<E = GAEvent> = E extends {
    event: infer Name
    eventAction: infer Action
}
    ? string extends Action
        ? Name
        : never
    : never

it("no event takes free text as its action", () => {
    // Checked by `yarn typecheck`: fails with the names of the loose events
    expectTypeOf<FreeTextEvent>().toBeNever()
})

it("no retired event can be sent", () => {
    // Checked by `yarn typecheck`: fails with the names of the retired events
    // that `logToGA` still accepts. The templates compare the names as strings,
    // since values of two different enums never match.
    expectTypeOf<
        Extract<`${GAEvent["event"]}`, `${RetiredEventCategory}`>
    >().toBeNever()
})
