#! /usr/bin/env jest

import { TopicsOriginUrl1652989496261 as migration } from "../migration/1652989496261-TopicsOriginUrl.js"

it("normalizes origin urls", async () => {
    const normalizedPath = `/test`
    const urls = [
        "https://ourworldindata.org/test",
        "https://ourworldindata.org/test/",
        "http://ourworldindata.org/test",
        "ourworldindata.org/test",
        "OurWorldInData.org/test",
    ]

    urls.forEach(async (url) => {
        expect((await migration.resolveOriginUrl(url)).pathname).toEqual(
            normalizedPath
        )
    })
})

it("resolves origin urls", async () => {
    const urls = [
        "https://ourworldindata.org/international-trade",
        "https://ourworldindata.org/global-rise-of-education/",
        "https://sdg-tracker.org/no-poverty",
    ]
    const targetPaths = [
        "/trade-and-globalization",
        "/global-education",
        "/no-poverty",
    ]

    urls.forEach(async (url, idx) => {
        expect((await migration.resolveOriginUrl(url)).pathname).toEqual(
            targetPaths[idx]
        )
    })
})
