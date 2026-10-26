import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import {
    DEFAULT_COUNTRY,
    MIGRATION_VIEWS,
    SEXES,
    VariantName,
} from "./core/types.js"
import { SankeyVariant } from "./variants/SankeyVariant"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
    BespokeConfigSpec,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { ConfigFromSpec, parseConfigFromSpec } from "../../../helpers/config.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "sankey",
        description:
            "Sankey of where one country's immigrants were born and where its emigrants live",
        component: SankeyVariant,
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        description:
            "Chart title, replacing the generated one. Also hides the heading and controls",
    },
    subtitle: {
        type: "string",
        description: "Chart subtitle. Also hides the heading and controls",
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
    sex: {
        type: "enum",
        values: SEXES,
        default: "both",
        description: "Sex shown first",
    },
    flow: {
        type: "enum",
        values: MIGRATION_VIEWS,
        default: "both",
        description: "Migration direction shown first",
    },
    hideControls: {
        type: "boolean",
        description:
            "Hide the heading and the country, sex, year and flow controls",
    },
    hideHeading: {
        type: "boolean",
        description: "Hide the heading above the controls",
    },
    hideFlowSwitcher: {
        type: "boolean",
        description: "Hide the switch between immigrants, emigrants and both",
    },
} as const satisfies BespokeConfigSpec

export type MigrationConfig = ConfigFromSpec<typeof CONFIG_SPEC>

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
            <variant.component config={config} urls={urls} />
        </>
    )
    return () => root.unmount()
}
