import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
    BespokeConfigSpec,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { migrateLegacyUrlParams } from "../../../helpers/legacyUrlParams.js"
import { ConfigFromSpec, parseConfigFromSpec } from "../../../helpers/config.js"
import { EmbedOptionsProvider } from "../../../hooks/useEmbedOptions.js"

import { SimulationVariant } from "./variants/SimulationVariant.js"
import { PopulationVariant } from "./variants/PopulationVariant.js"
import { PopulationPyramidVariant } from "./variants/PopulationPyramidVariant.js"
import { ParametersVariant } from "./variants/ParametersVariant.js"
import {
    PARAMETER_KEYS,
    POPULATION_PYRAMID_UNITS,
    VariantName,
} from "./core/types.js"
import { parseControlPoints } from "./core/parsers.js"
import { DEMOGRAPHY_LEGACY_URL_PARAM_NAMES } from "./core/urlState.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "simulation",
        description:
            "Population projection for one country where readers set the fertility, life expectancy and migration assumptions",
        component: SimulationVariant,
        defaultSize: "widest",
    },
    {
        name: "population",
        description:
            "Line chart of one country's population over time, by default the UN projection",
        component: PopulationVariant,
        defaultSize: "wide",
    },
    {
        name: "populationPyramid",
        description: "Age and sex pyramid of one country's population",
        component: PopulationPyramidVariant,
        defaultSize: "narrow",
    },
    {
        name: "parameters",
        description:
            "Line charts of the fertility, life expectancy and migration assumptions behind one country's population projection",
        component: ParametersVariant,
        defaultSize: "narrow",
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        description: "Chart title, replacing the generated one",
    },
    subtitle: {
        type: "string",
        description: "Chart subtitle, replacing the generated one",
    },
    region: {
        type: "string",
        default: "userLocation",
        description:
            "Country shown first, or United States if the data doesn't have it. `userLocation` picks the reader's country",
    },
    time: {
        type: "integer",
        default: "2100",
        description: "Year shown first. `populationPyramid` only",
    },
    fertilityRateAssumptions: {
        type: "custom",
        format: "Up to three comma-separated numbers for 2030, 2050 and 2100, such as `1.8,,1.5`. An empty entry keeps the UN projection",
        parse: parseControlPoints,
        description: "Fertility rate assumptions, in births per woman",
    },
    lifeExpectancyAssumptions: {
        type: "custom",
        format: "Up to three comma-separated numbers for 2030, 2050 and 2100, such as `80,,85`. An empty entry keeps the UN projection",
        parse: parseControlPoints,
        description: "Life expectancy assumptions, in years",
    },
    netMigrationRateAssumptions: {
        type: "custom",
        format: "Up to three comma-separated numbers for 2030, 2050 and 2100, such as `2,,1`. An empty entry keeps the UN projection",
        parse: parseControlPoints,
        description:
            "Net migration rate assumptions, per 1,000 people. The chart shows them as a percentage",
    },
    focusParameter: {
        type: "enum",
        values: PARAMETER_KEYS,
        default: "fertilityRate",
        description: "Assumption shown first in the editor. `simulation` only",
    },
    populationPyramidUnit: {
        type: "enum",
        values: POPULATION_PYRAMID_UNITS,
        default: "percent",
        description:
            "Show the pyramid as shares or as numbers of people. `simulation` and `populationPyramid` only",
    },
    hideEntitySelector: {
        type: "boolean",
        description: "Show the country as plain text instead of a selector",
    },
    hidePopulationPyramid: {
        type: "boolean",
        description: "Hide the population pyramid. `simulation` only",
    },
    hideTimeline: {
        type: "boolean",
        description:
            "Hide the year slider and fit the axis to the year shown. `populationPyramid` only",
    },
    showAssumptionCharts: {
        type: "boolean",
        description:
            "Add a collapsible section with the assumption charts. `population` and `populationPyramid` only",
    },
} as const satisfies BespokeConfigSpec

export type DemographyConfig = ConfigFromSpec<typeof CONFIG_SPEC>

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: BespokeComponentMountOpts
) => {
    const variant = VARIANTS.find((v) => v.name === opts.variant)
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    if (!opts.dataUrl || !opts.metadataUrl) {
        container.textContent =
            "Missing data URLs: add an entry for this bundle to the bespoke component registry"
        return
    }

    const urls = { dataUrl: opts.dataUrl, metadataUrl: opts.metadataUrl }

    const authoredConfig = opts.config ?? {}
    const config = parseConfigFromSpec(CONFIG_SPEC, authoredConfig)

    if (opts.embedOptions?.urlSync) {
        migrateLegacyUrlParams(DEMOGRAPHY_LEGACY_URL_PARAM_NAMES)
    }

    const root = createRoot(container)
    root.render(
        <>
            <StylesTarget />
            <EmbedOptionsProvider options={opts.embedOptions}>
                <variant.component config={config} urls={urls} />
            </EmbedOptionsProvider>
        </>
    )
    return () => root.unmount()
}
