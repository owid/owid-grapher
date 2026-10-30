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

import { DEFAULT_COUNTRY } from "./core/constants.js"
import { SHOW_MODES, VariantName } from "./core/types.js"
import { PyramidVariant } from "./variants/PyramidVariant.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "pyramid",
        description: "Age and sex pyramid of immigrants living in one country",
        component: PyramidVariant,
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
    country: {
        type: "string",
        default: DEFAULT_COUNTRY,
        description:
            "Country shown first, or United States if the data doesn't have it. `userLocation` picks the reader's country",
    },
    year: {
        type: "integer",
        description:
            "Year shown first. Defaults to the latest year in the data",
    },
    show: {
        type: "enum",
        values: SHOW_MODES,
        default: "number",
        description:
            "Show immigrants as a number or a share. Ignored when compare is on",
    },
    compare: {
        type: "boolean",
        default: "false",
        description:
            "Start compared with the native-born population, shown as shares",
    },
    hideControls: {
        type: "boolean",
        description:
            "Hide the country, year, number-or-share and native-born comparison controls",
    },
} as const satisfies BespokeConfigSpec

export type MigrantDemographicsConfig = ConfigFromSpec<typeof CONFIG_SPEC>

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
