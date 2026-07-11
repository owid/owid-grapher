import { createRoot } from "react-dom/client"
import { getDefaultStore } from "jotai"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import type { VariantName } from "./types.js"
import { App, CardOnly, ControlsOnly } from "./components/App.js"
import {
    COUNTRIES_BY_CODE,
    HIGHLIGHTS_LABEL,
    TOPICS,
} from "./helpers/catalog.js"
import {
    birthYearAtom,
    compareCodeAtom,
    countryCodeAtom,
    topicAtom,
} from "./atoms.js"
import {
    COMPARE_PARAM,
    COUNTRY_PARAM,
    TOPIC_PARAM,
    YEAR_PARAM,
    enableUrlSync,
} from "./helpers/urlSync.js"

import "./index.scss"

export const VARIANTS = [
    {
        name: "app",
        component: App,
        demoConfig: { country: "CZE", year: "1993" },
    },
    { name: "controls", component: ControlsOnly, demoConfig: {} },
    {
        name: "card",
        component: CardOnly,
        demoConfig: { country: "ESP", year: "1975", topic: "Health" },
    },
] satisfies BespokeComponentVariantsList<VariantName>

/**
 * Seed the shared atoms from the ArchieML config and the page URL. URL params
 * (?lifeCountry=CZE&lifeYear=1993) win over config — that's the "comms layer"
 * trick: publicise a link that lands with the reader's settings applied.
 */
function hydrateStateFromConfigAndUrl(config: Record<string, string>): void {
    const store = getDefaultStore()
    const params = new URLSearchParams(window.location.search)
    const get = (param: string, configKey: string): string | undefined =>
        params.get(param) ?? config[configKey]

    const country = get(COUNTRY_PARAM, "country")
    if (country && COUNTRIES_BY_CODE.has(country))
        store.set(countryCodeAtom, country)

    const year = parseInt(get(YEAR_PARAM, "year") ?? "", 10)
    if (
        Number.isFinite(year) &&
        year >= 1900 &&
        year <= new Date().getFullYear()
    )
        store.set(birthYearAtom, year)

    const topic = get(TOPIC_PARAM, "topic")
    if (topic && (topic === HIGHLIGHTS_LABEL || TOPICS.includes(topic)))
        store.set(topicAtom, topic)

    const compare = get(COMPARE_PARAM, "compare")
    if (compare) store.set(compareCodeAtom, compare)

    if (config.urlSync === "true") enableUrlSync()
}

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
) => {
    // default to the full app when no variant is given
    const variant =
        VARIANTS.find((v) => v.name === opts.variant) ??
        (opts.variant ? undefined : VARIANTS[0])
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    hydrateStateFromConfigAndUrl(opts.config ?? {})

    const root = createRoot(container)
    root.render(
        <>
            {/* This is where Vite-injected styles are placed inside the Shadow DOM */}
            <StylesTarget />
            <variant.component />
        </>
    )
    return () => root.unmount()
}
