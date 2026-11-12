import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
    BespokeConfigSpec,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { ConfigFromSpec, parseConfigFromSpec } from "../../../helpers/config.js"
import { EmbedOptionsProvider } from "../../../hooks/useEmbedOptions.js"

import { DEFAULT_YEAR } from "./core/constants.js"
import { parseCountryList, parsePositiveNumber } from "./core/parsers.js"
import { TIME_INTERVALS, VIEWS, VariantName } from "./core/types.js"
import { DistributionVariant } from "./variants/DistributionVariant.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "distribution",
        description:
            "Income mountains: how the world's population, or that of a few countries compared, is spread across income levels",
        component: DistributionVariant,
        defaultSize: "wide",
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        description:
            "Chart title, replacing the generated one. Also hides the controls",
    },
    subtitle: {
        type: "string",
        description:
            "Chart subtitle, replacing the generated one. Also hides the controls",
    },
    view: {
        type: "enum",
        values: VIEWS,
        default: "global",
        description:
            "View shown first: `global` stacks every country by World Bank region, `countries` compares the countries in `countries` side by side",
    },
    countries: {
        type: "custom",
        format: "Comma-separated country names, such as `China, India, userLocation`",
        parse: parseCountryList,
        description:
            "Countries of the compare-countries view, up to 8. `userLocation` adds the user's country. Defaults to China, the United States, India, Nigeria and the user's country",
    },
    year: {
        type: "integer",
        default: DEFAULT_YEAR,
        description:
            "Year shown, from 1990 to 2026. The chart has no year control. From 2025 on, the figures are World Bank nowcasts",
    },
    povertyLine: {
        type: "custom",
        format: "A positive number, such as `8.3`",
        parse: parsePositiveNumber,
        description:
            "Poverty line drawn first, in international-$ per day; `3` is the World Bank's international poverty line. If unset, the chart starts without one, and the user can add one from the controls or by clicking the chart",
    },
    timeInterval: {
        type: "enum",
        values: TIME_INTERVALS,
        default: "monthly",
        description: "Whether incomes are shown per day, month or year",
    },
    currency: {
        type: "string",
        description:
            "Three-letter code of the country whose currency incomes are shown in, such as `DEU`. `userLocation` picks the user's currency. Defaults to international-$",
    },
    hideControls: {
        type: "boolean",
        description:
            "Hide the view, countries, measured-in and poverty line controls, and the ways of removing the poverty line from the chart and its legend",
    },
} as const satisfies BespokeConfigSpec

export type IncomeDistributionConfig = ConfigFromSpec<typeof CONFIG_SPEC>

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

    const config = parseConfigFromSpec(CONFIG_SPEC, opts.config ?? {})

    const root = createRoot(container)
    root.render(
        <>
            {/* This is where Vite-injected styles will be placed - make sure to add this to your code so that the styles are correctly injected into the Shadow DOM. */}
            <StylesTarget />
            <EmbedOptionsProvider options={opts.embedOptions}>
                <variant.component config={config} urls={urls} />
            </EmbedOptionsProvider>
        </>
    )
    return () => root.unmount()
}
