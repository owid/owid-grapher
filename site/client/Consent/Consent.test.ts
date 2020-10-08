#! /usr/bin/env yarn jest

import { ConsentType, getConsent, updateConsent } from "./Consent"

describe("gdpr consent", () => {
    it("gets consent values", () => {
        expect(getConsent(ConsentType.Performance)).toBeUndefined()
        expect(getConsent(ConsentType.Performance, "")).toBeUndefined()
        expect(getConsent(ConsentType.Performance, "x:2")).toBeUndefined()
        expect(getConsent(ConsentType.Performance, "p:1|m:0")).toEqual("1")
        expect(getConsent(ConsentType.Performance, "m:0|p:13")).toEqual("13")
        // expect(getConsent(ConsentType.Marketing, "p:1|m:2")).toEqual("2")
    })

    it("sets consent values", () => {
        expect(updateConsent(ConsentType.Performance, "0")).toEqual("p:0")
        expect(updateConsent(ConsentType.Performance, "0", "")).toEqual("p:0")
        expect(updateConsent(ConsentType.Performance, "13", "")).toEqual("p:13")
        // expect(updateConsent(ConsentType.Marketing, "1", "p:1")).toEqual(
        //     "p:1|m:1"
        // )
    })

    it("updates consent values", () => {
        expect(updateConsent(ConsentType.Performance, "0", "p:1")).toEqual(
            "p:0"
        )
        expect(
            updateConsent(ConsentType.Performance, "0", "p:1|m:0|n:1")
        ).toEqual("m:0|n:1|p:0")
        expect(
            updateConsent(ConsentType.Performance, "13", "p:1|m:0|n:1")
        ).toEqual("m:0|n:1|p:13")
        // expect(
        //     updateConsent(ConsentType.Marketing, "1", "p:1|m:0|n:1")
        // ).toEqual("p:1|n:1|m:1")
    })
})
