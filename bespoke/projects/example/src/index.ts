import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { enableShadowDOM } from "@react-stately/flags"

import { Chart } from "./components/Chart"
import { Picker } from "./components/Picker"
import { Display } from "./components/Display"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"

// Styles for portaled react-aria overlays (e.g. dropdown menus) that render
// outside the Shadow DOM. On the real site these are available globally;
// importing them here ensures they're present on the demo page too.
import "./demo.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    { name: "picker", component: Picker, defaultConfig: {} },
    { name: "display", component: Display, defaultConfig: {} },
    { name: "chart", component: Chart, defaultConfig: {} },
] satisfies BespokeComponentVariantsList

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
    root.render(createElement(variant.component))
    return () => root.unmount()
}
