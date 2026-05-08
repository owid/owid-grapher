import { describe, expect, it } from "vitest"
import { getCommonEventParams } from "./analytics.js"

describe(getCommonEventParams, () => {
    it("prefixes all URL query params with q_", () => {
        const request = new Request(
            "https://ourworldindata.org/grapher/foo?country=DE&host=evil&bar=baz&status_code=999",
            {
                headers: {
                    referer: "https://ourworldindata.org/coronavirus",
                    "user-agent": "Mozilla/5.0 (test)",
                    "cf-ipcountry": "US",
                },
            }
        )

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

        expect(params.q_bar).toBe("baz")
        expect(params.q_country).toBe("DE")
        expect(params.q_host).toBe("evil")
        expect(params.q_status_code).toBe("999")

        expect(params.bar).toBeUndefined()
        expect(params.host).not.toBe("evil")
        expect(params.status_code).toBeUndefined()
    })
})
