/**
 * PROTOTYPE: total fertility rates published by national statistics offices
 * (NSO), extracted from an internal investigation of the 100 most populous
 * countries. Used to co-plot an alternative, NSO-anchored fertility scenario
 * next to the UN WPP one.
 *
 * The JSON lives in the repo's `public/` dir, so it is served from the site
 * root when baked (staging/production) and by the site Vite dev server
 * locally.
 */

import { QueryStatus, useQuery } from "@tanstack/react-query"
import { fetchJson } from "@ourworldindata/utils"

export type YearValue = [number, number]

export interface NsoTfrCountry {
    country: string
    iso?: string
    short?: string
    tier?: string
    tierLabel?: string
    recalculated?: boolean
    source?: string
    latest?: { year: number; nso: number; wpp: number }
    /** NSO TFR observations as [year, tfr] pairs */
    nso?: YearValue[]
    /** UN WPP 2024 estimates as [year, tfr] pairs */
    wpp?: YearValue[]
    /** UN WPP projection variants, roughly 2023-2032 */
    wppProjection?: {
        high?: YearValue[]
        medium?: YearValue[]
        low?: YearValue[]
    }
    docs?: Record<string, string>
    note?: string
}

export interface NsoTfrData {
    description: string
    tiers: Record<string, [string, string]>
    unplotted: { country: string; tier: string; note: string }[]
    countries: Record<string, NsoTfrCountry>
}

function getNsoTfrUrl(): string {
    if (typeof window === "undefined") return "/nso-tfr/nsoTfr.json"
    const { hostname, port } = window.location
    // In local dev the bespoke dev server (8089) and the admin (3030) don't
    // serve the repo's public/ dir — the site Vite dev server (8090) does.
    if (
        (hostname === "localhost" || hostname === "127.0.0.1") &&
        port !== "8090"
    ) {
        return "http://localhost:8090/nso-tfr/nsoTfr.json"
    }
    return "/nso-tfr/nsoTfr.json"
}

export function useNsoTfrData(): { data?: NsoTfrData; status: QueryStatus } {
    const result = useQuery({
        queryKey: ["demography", "nso-tfr"],
        queryFn: () => fetchJson<NsoTfrData>(getNsoTfrUrl()),
        staleTime: Infinity,
        retry: 1,
    })
    return { data: result.data, status: result.status }
}

/** NSO TFR entry for a country, or undefined while loading / when unavailable */
export function useNsoTfrCountry(
    countryName: string
): NsoTfrCountry | undefined {
    const { data } = useNsoTfrData()
    return data?.countries[countryName]
}
