import { describe, expect, it } from "vitest"
import {
    getCommonEventParams,
    getSamplingRate,
    parseAsnSamplingRates,
} from "./analytics.js"

describe(getCommonEventParams, () => {
    it("returns common event params and URL query params", () => {
        const request = new Request<unknown, IncomingRequestCfProperties>(
            "https://ourworldindata.org/grapher/foo?country=DE&host=evil&bar=baz&status_code=999",
            {
                headers: {
                    referer: "https://ourworldindata.org/coronavirus",
                    "user-agent": "Mozilla/5.0 (test)",
                    "cf-ipcountry": "US",
                },
            }
        )
        // Cloudflare populates request.cf in production; simulate it here.
        Object.assign(request, {
            cf: {
                asOrganization: "Amazon.com",
                asn: 16509,
                botManagement: { verifiedBot: true, score: 30 },
                verifiedBotCategory: "Search Engine Crawler",
            },
        })

        const params = getCommonEventParams(request, {
            CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE: "0.25",
        })

        expect(params.host).toBe("ourworldindata.org")
        expect(params.pathname).toBe("/grapher/foo")
        expect(params.referrer).toBe("https://ourworldindata.org/coronavirus")
        expect(params.user_agent).toBe("Mozilla/5.0 (test)")
        expect(params.method).toBe("GET")
        expect(params.country).toBe("US")
        expect(params.sampling).toBe(0.25)
        expect(params.as_org).toBe("Amazon.com")
        expect(params.asn).toBe(16509)
        expect(params.bot_score).toBe(30)
        expect(params.verified_bot).toBe(1)
        expect(params.verified_bot_category).toBe("Search Engine Crawler")

        expect(params.q_bar).toBe("baz")
        expect(params.q_country).toBe("DE")
        expect(params.q_host).toBe("evil")
        expect(params.q_status_code).toBe("999")

        expect(params.bar).toBeUndefined()
        expect(params.host).not.toBe("evil")
        expect(params.status_code).toBeUndefined()
    })

    it("uses ASN-specific sampling rates when configured", () => {
        const request = new Request<unknown, IncomingRequestCfProperties>(
            "https://ourworldindata.org/"
        )
        Object.assign(request, { cf: { asn: 15169 } })

        expect(
            getSamplingRate(request, {
                CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE: "0.01",
                CLOUDFLARE_GOOGLE_ANALYTICS_ASN_SAMPLING_RATES:
                    "16509:0.5,15169:1",
            })
        ).toBe(1)
    })

    it("parses valid ASN sampling overrides", () => {
        expect(
            Array.from(
                parseAsnSamplingRates("16509:0.5,invalid:1,15169:2,8075:1")
            )
        ).toEqual([
            [16509, 0.5],
            [8075, 1],
        ])
    })
})
