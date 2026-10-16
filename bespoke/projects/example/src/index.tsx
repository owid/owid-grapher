import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import { VariantName } from "./core/constants.js"
import { Chart } from "./components/Chart"
import { Picker } from "./components/Picker"
import { Display } from "./components/Display"

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
        name: "picker",
        description:
            "Food dropdown and color swatches that drive the display variant",
        component: Picker,
    },
    {
        name: "display",
        description: "Icon of the food and color chosen in the picker variant",
        component: Display,
    },
    {
        name: "chart",
        description:
            "Placeholder chart with no data that shows the layout bounds",
        component: Chart,
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        default: "Example chart",
        description: "Title of the chart variant",
    },
} as const satisfies BespokeConfigSpec

export type ExampleConfig = ConfigFromSpec<typeof CONFIG_SPEC>

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: BespokeComponentMountOpts
) => {
    const variant = VARIANTS.find((v) => v.name === opts.variant)
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    const authoredConfig = opts.config ?? {}
    const config = parseConfigFromSpec(CONFIG_SPEC, authoredConfig)

    const root = createRoot(container)
    root.render(
        <>
            {/* This is where Vite-injected styles will be placed - make sure to add this to your code so that the styles are correctly injected into the Shadow DOM. */}
            <StylesTarget />
            <variant.component config={config} />
        </>
    )
    return () => root.unmount()
}
