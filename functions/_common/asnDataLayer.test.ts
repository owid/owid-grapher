import { describe, expect, it } from "vitest"
import { buildDataLayerScript } from "./asnDataLayer.js"

describe(buildDataLayerScript, () => {
    it("builds a script tag pushing asn and as_org onto the dataLayer", () => {
        const script = buildDataLayerScript({
            asn: 680,
            asOrganization:
                "Verein zur Foerderung eines Deutschen Forschungsnetzes e.V.",
        })
        expect(script).toBe(
            `<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push({"asn":680,"as_org":"Verein zur Foerderung eines Deutschen Forschungsnetzes e.V."});</script>`
        )
    })

    it("escapes '<' so an org name can't break out of the script tag", () => {
        const script = buildDataLayerScript({
            asn: 1,
            asOrganization: `</script><script>alert(1)`,
        })
        expect(script).not.toContain("</script><script>")
        expect(script).toContain("\\u003c/script")
    })

    it("truncates as_org to 100 characters", () => {
        const script = buildDataLayerScript({
            asn: 1,
            asOrganization: "x".repeat(150),
        })
        expect(script).toContain(`"as_org":"${"x".repeat(100)}"`)
    })

    it("omits the missing field when only one of asn/asOrganization is present", () => {
        expect(buildDataLayerScript({ asn: 13335 })).toContain(`{"asn":13335}`)
        expect(
            buildDataLayerScript({ asOrganization: "Cloudflare" })
        ).toContain(`{"as_org":"Cloudflare"}`)
    })

    it("includes verified_bot_category when Cloudflare flagged a verified bot", () => {
        expect(
            buildDataLayerScript({
                asn: 15169,
                asOrganization: "Google LLC",
                verifiedBotCategory: "Search Engine Crawler",
            })
        ).toContain(`"verified_bot_category":"Search Engine Crawler"`)
    })

    it("omits verified_bot_category for non-bot traffic", () => {
        // Absent means "not a verified bot", so the key must not be sent empty
        expect(buildDataLayerScript({ asn: 680 })).not.toContain(
            "verified_bot_category"
        )
        expect(
            buildDataLayerScript({ asn: 680, verifiedBotCategory: "" })
        ).not.toContain("verified_bot_category")
    })

    it("returns undefined when cf info is absent (e.g. local dev)", () => {
        expect(buildDataLayerScript(undefined)).toBeUndefined()
        expect(buildDataLayerScript({})).toBeUndefined()
        expect(
            buildDataLayerScript({ asn: 0, asOrganization: "" })
        ).toBeUndefined()
    })
})
