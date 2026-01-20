/**
 * Test file to see real peer selection results with actual data.
 * This file is for exploration only - not meant to be kept.
 *
 * Run with: yarn test run packages/@ourworldindata/grapher/src/core/PeerCountrySelection.realdata.test.ts
 */

import { expect, it, describe } from "vitest"
import { findClosestByValue } from "./PeerCountrySelection.js"
import {
    GDP_PER_CAPITA_INDICATOR_ID_USED_FOR_PEER_SELECTION,
    POPULATION_INDICATOR_ID_USED_FOR_PEER_SELECTION,
} from "./GrapherConstants.js"
import { countries, getContinentForCountry } from "@ourworldindata/utils"

// Diverse set of important countries for testing peer selection
const TEST_COUNTRIES: { name: string; reason: string }[] = [
    // Large high-income
    { name: "United States", reason: "Largest high-income economy" },
    { name: "Germany", reason: "Europe's largest economy" },
    { name: "France", reason: "Major European economy, mid-sized population" },
    // Large populations
    { name: "China", reason: "Most populous country, rapid development" },
    { name: "India", reason: "Second most populous, lower-middle income" },
    { name: "Nigeria", reason: "Africa's most populous country" },
    { name: "Brazil", reason: "Latin America's largest economy" },
    { name: "Indonesia", reason: "Southeast Asia's largest economy" },
    // Lower-middle income
    { name: "Bangladesh", reason: "Densely populated lower-middle income" },
    { name: "Kenya", reason: "East African lower-middle income hub" },
    // Low income
    { name: "Ethiopia", reason: "Large low-income African country" },
    { name: "Burundi", reason: "One of the poorest countries globally" },
    { name: "Madagascar", reason: "Low-income island nation" },
    // Small high-income
    { name: "Singapore", reason: "Small wealthy city-state" },
    { name: "Luxembourg", reason: "Tiny high-income European country" },
    // Small lower/middle income
    { name: "Jamaica", reason: "Small Caribbean upper-middle income" },
    { name: "Rwanda", reason: "Small low-income African success story" },
]

// Fetch variable data from the API and return latest values per country
async function fetchVariableData(
    variableId: number
): Promise<Map<string, number>> {
    const metaResponse = await fetch(
        `https://api.ourworldindata.org/v1/indicators/${variableId}.metadata.json`
    )
    const meta = await metaResponse.json()
    const entityIdToName = new Map<number, string>(
        meta.dimensions.entities.values.map(
            (e: { id: number; name: string }) => [e.id, e.name]
        )
    )

    const dataResponse = await fetch(
        `https://api.ourworldindata.org/v1/indicators/${variableId}.data.json`
    )
    const data = await dataResponse.json()

    const countryNames = new Set(countries.map((c) => c.name))
    const entityValues = new Map<string, { value: number; year: number }>()

    for (let i = 0; i < data.entities.length; i++) {
        const entityId = data.entities[i]
        const entityName = entityIdToName.get(entityId)
        if (!entityName || !countryNames.has(entityName)) continue

        const year = data.years[i]
        const value = data.values[i]

        const existing = entityValues.get(entityName)
        if (!existing || year > existing.year) {
            entityValues.set(entityName, { value, year })
        }
    }

    const result = new Map<string, number>()
    for (const [name, { value }] of entityValues) {
        result.set(name, value)
    }
    return result
}

function formatNumber(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
    return n.toFixed(0)
}

describe("Peer Selection Strategies - Demo with Real Data", () => {
    let gdpData: Map<string, number>
    let popData: Map<string, number>

    it("shows peer selection results for test countries", async () => {
        // Fetch real data
        ;[gdpData, popData] = await Promise.all([
            fetchVariableData(
                GDP_PER_CAPITA_INDICATOR_ID_USED_FOR_PEER_SELECTION
            ),
            fetchVariableData(POPULATION_INDICATOR_ID_USED_FOR_PEER_SELECTION),
        ])

        console.log(`\n${"=".repeat(90)}`)
        console.log(
            `PEER SELECTION STRATEGIES - Real Data Demo (${gdpData.size} countries with GDP data)`
        )
        console.log(
            `(prefers same continent, falls back to global if no peers found)`
        )
        console.log(`${"=".repeat(90)}\n`)

        const formatPeers = (peers: string[], targetCount: number): string => {
            if (peers.length === 0) return "(no peers)"
            if (targetCount === 3) return peers.slice(0, 3).join(", ")
            const first3 = peers.slice(0, 3)
            const extra2 = peers.slice(3, 5)
            return (
                first3.join(", ") +
                (extra2.length > 0 ? ` (${extra2.join(", ")})` : "")
            )
        }

        const GDP_MAX_PEER_RATIO = 1.25
        const POP_MAX_PEER_RATIO = 1.5

        console.log(
            `\n--- GDP per Capita peers (maxPeerRatio = ${GDP_MAX_PEER_RATIO}) ---\n`
        )

        console.log("targetCount = 3:")
        for (const { name: country } of TEST_COUNTRIES) {
            const peers = findClosestByValue({
                targetEntityName: country,
                entityValues: gdpData,
                targetCount: 3,
                maxPeerRatio: GDP_MAX_PEER_RATIO,
            })
            console.log(`- ${country} → ${formatPeers(peers, 3)}`)
        }

        console.log("\ntargetCount = 5:")
        for (const { name: country } of TEST_COUNTRIES) {
            const peers = findClosestByValue({
                targetEntityName: country,
                entityValues: gdpData,
                targetCount: 5,
                maxPeerRatio: GDP_MAX_PEER_RATIO,
            })
            console.log(`- ${country} → ${formatPeers(peers, 5)}`)
        }

        console.log(
            `\n--- Population peers (maxPeerRatio = ${POP_MAX_PEER_RATIO}) ---\n`
        )

        console.log("targetCount = 3:")
        for (const { name: country } of TEST_COUNTRIES) {
            const peers = findClosestByValue({
                targetEntityName: country,
                entityValues: popData,
                targetCount: 3,
                maxPeerRatio: POP_MAX_PEER_RATIO,
            })
            console.log(`- ${country} → ${formatPeers(peers, 3)}`)
        }

        console.log("\ntargetCount = 5:")
        for (const { name: country } of TEST_COUNTRIES) {
            const peers = findClosestByValue({
                targetEntityName: country,
                entityValues: popData,
                targetCount: 5,
                maxPeerRatio: POP_MAX_PEER_RATIO,
            })
            console.log(`- ${country} → ${formatPeers(peers, 5)}`)
        }

        console.log(`\n`)
        expect(true).toBe(true)
    }, 60000)
})
