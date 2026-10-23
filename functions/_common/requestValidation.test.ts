import { describe, expect, it } from "vitest"
import { EmailNotificationsSubscribeRequestTypeObject } from "@ourworldindata/types/email-notifications-schemas"
import { describeInvalidRequest } from "./requestValidation.js"

const reject = (payload: unknown): string => {
    const result =
        EmailNotificationsSubscribeRequestTypeObject.safeParse(payload)
    if (result.success) throw new Error("expected the payload to be rejected")
    return describeInvalidRequest(result.error)
}

describe(describeInvalidRequest, () => {
    it("asks for a valid address when the email is rejected", () => {
        expect(reject({ email: "ike@test", subscribeToOwidBrief: true })).toBe(
            "Please enter a valid email address."
        )
    })

    it("passes on the message of a reader-facing refinement", () => {
        expect(
            reject({
                email: "user@example.com",
                captchaToken: "token",
                subscribeToOwidBrief: false,
            })
        ).toBe("Select email notifications or the OWID Brief newsletter")
    })

    it("falls back to generic copy for any other field", () => {
        expect(
            reject({ email: "user@example.com", subscribeToOwidBrief: "yes" })
        ).toBe("Please check your selection and try again.")
    })
})
