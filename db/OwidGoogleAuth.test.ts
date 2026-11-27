import { describe, expect, it } from "vitest"
import { explainSuggestionsAccessError } from "./OwidGoogleAuth.js"

// Google's client throws errors carrying the HTTP status on `status`
function googleError(status: number, message: string): Error {
    return Object.assign(new Error(message), { status })
}

describe(explainSuggestionsAccessError, () => {
    it("names the access the service account is missing on a 403", () => {
        const error = googleError(
            403,
            "You do not have permission to access the document suggestions."
        )
        const explained = explainSuggestionsAccessError(
            error,
            "sa@example.iam.gserviceaccount.com"
        )

        expect(explained).toBeInstanceOf(Error)
        const { message, cause } = explained as Error
        expect(message).toContain("sa@example.iam.gserviceaccount.com")
        expect(message).toContain("Commenter access")
        // Google's own wording stays, since it varies between docs
        expect(message).toContain(error.message)
        expect(cause).toBe(error)
    })

    it.each([
        googleError(404, "Requested entity was not found."),
        googleError(500, "Internal error"),
        new Error("socket hang up"),
    ])("passes other errors through untouched: %s", (error) => {
        expect(explainSuggestionsAccessError(error)).toBe(error)
    })
})
