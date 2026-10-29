import { describe, expect, it } from "vitest"

import {
    PRODUCTION_DATA_BASE_URL,
    resolveBespokeComponentUrls,
} from "./bespokeComponentUrls.js"

const SCRIPT_BASE_URL = "https://ourworldindata.org/bespoke"
const STAGING_DATA_BASE_URL =
    "https://api-staging.owid.io/staging-site-my-branch/v1/bespoke"

describe(resolveBespokeComponentUrls, () => {
    it("resolves a feed step against the environment's data base", () => {
        const urls = resolveBespokeComponentUrls(
            {
                scriptUrl: "/food-trade/index.js",
                dataUrl: "faostat/latest/food_trade",
                metadataFilename: "food-trade.metadata.json",
            },
            {
                scriptBaseUrl: SCRIPT_BASE_URL,
                dataBaseUrl: STAGING_DATA_BASE_URL,
            }
        )

        expect(urls).toEqual({
            scriptUrl: `${SCRIPT_BASE_URL}/food-trade/index.js`,
            dataUrl: `${STAGING_DATA_BASE_URL}/faostat/latest/food_trade`,
            metadataUrl: `${STAGING_DATA_BASE_URL}/faostat/latest/food_trade/food-trade.metadata.json`,
        })
    })

    it("passes absolute URLs through", () => {
        const urls = resolveBespokeComponentUrls(
            {
                scriptUrl: "https://example.org/demography/index.js",
                dataUrl: "https://owid-public.owid.io/bespoke/demography",
                metadataFilename: "demography.metadata.json",
            },
            {
                scriptBaseUrl: SCRIPT_BASE_URL,
                dataBaseUrl: STAGING_DATA_BASE_URL,
            }
        )

        expect(urls).toEqual({
            scriptUrl: "https://example.org/demography/index.js",
            dataUrl: "https://owid-public.owid.io/bespoke/demography",
            metadataUrl:
                "https://owid-public.owid.io/bespoke/demography/demography.metadata.json",
        })
    })

    it("falls back to production data when no environment is given", () => {
        const urls = resolveBespokeComponentUrls(
            {
                scriptUrl: "/food-trade/index.js",
                dataUrl: "faostat/latest",
                metadataFilename: "food-trade.metadata.json",
            },
            {}
        )

        expect(urls.scriptUrl).toBe("/food-trade/index.js")
        expect(urls.dataUrl).toBe(`${PRODUCTION_DATA_BASE_URL}/faostat/latest`)
        expect(urls.metadataUrl).toBe(
            `${PRODUCTION_DATA_BASE_URL}/faostat/latest/food-trade.metadata.json`
        )
    })

    it("tolerates the trailing slash staging writes on the data base", () => {
        const urls = resolveBespokeComponentUrls(
            {
                scriptUrl: "/index.js",
                dataUrl: "faostat/latest",
                metadataFilename: "food-trade.metadata.json",
            },
            { dataBaseUrl: "https://example.org/v1/bespoke/" }
        )

        expect(urls.dataUrl).toBe(
            "https://example.org/v1/bespoke/faostat/latest"
        )
    })

    it("reads a blank base as no base at all", () => {
        const urls = resolveBespokeComponentUrls(
            {
                scriptUrl: "/index.js",
                dataUrl: "faostat/latest",
                metadataFilename: "food-trade.metadata.json",
            },
            { scriptBaseUrl: "  ", dataBaseUrl: "  " }
        )

        expect(urls.scriptUrl).toBe("/index.js")
        expect(urls.dataUrl).toBe(`${PRODUCTION_DATA_BASE_URL}/faostat/latest`)
    })
})
