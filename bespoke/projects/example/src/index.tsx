import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import { VariantName } from "./constants.js"
import { Chart } from "./components/Chart"
import { Picker } from "./components/Picker"
import { Display } from "./components/Display"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    { name: "picker", component: Picker, demoConfig: {} },
    { name: "display", component: Display, demoConfig: {} },
    { name: "chart", component: Chart, demoConfig: {} },
] satisfies BespokeComponentVariantsList<VariantName>

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
) => {
    const variant = VARIANTS.find((v) => v.name === opts.variant)
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    const root = createRoot(container)
    root.render(
        <>
            {/* This is where Vite-injected styles will be placed - make sure to add this to your code so that the styles are correctly injected into the Shadow DOM. */}
            <StylesTarget />
            <variant.component />
        </>
    )
    return () => root.unmount()
}
