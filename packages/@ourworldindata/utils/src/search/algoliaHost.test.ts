import { describe, expect, it } from "vitest"
import {
    getAlgoliaBaseUrl,
    getAlgoliaHostClientOptions,
} from "./algoliaHost.js"

describe(getAlgoliaHostClientOptions, () => {
    it("leaves the SDK's default hosts alone when the setting is unset", () => {
        expect(getAlgoliaHostClientOptions("")).toEqual({})
        expect(getAlgoliaHostClientOptions(undefined)).toEqual({})
    })

    it("points the SDK at an http host with a port", () => {
        expect(getAlgoliaHostClientOptions("http://127.0.0.1:8799")).toEqual({
            hosts: [
                {
                    url: "127.0.0.1",
                    port: 8799,
                    protocol: "http",
                    accept: "readWrite",
                },
            ],
        })
    })

    it("points the SDK at an https host without a port", () => {
        expect(
            getAlgoliaHostClientOptions("https://algolia.example.com")
        ).toEqual({
            hosts: [
                {
                    url: "algolia.example.com",
                    protocol: "https",
                    accept: "readWrite",
                },
            ],
        })
    })
})

describe(getAlgoliaBaseUrl, () => {
    it("falls back to Algolia's own host for the app", () => {
        expect(getAlgoliaBaseUrl("APPID", "")).toBe(
            "https://APPID-dsn.algolia.net"
        )
    })

    it("uses the configured host", () => {
        expect(getAlgoliaBaseUrl("APPID", "http://127.0.0.1:8799/")).toBe(
            "http://127.0.0.1:8799"
        )
    })
})
