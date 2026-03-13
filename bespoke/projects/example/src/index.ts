import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { ColorPicker } from "./ColorPicker"
import { ColorDisplay } from "./ColorDisplay"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"

export const VARIANTS = [
    { name: "picker", component: ColorPicker, defaultConfig: {} },
    { name: "display", component: ColorDisplay, defaultConfig: {} },
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
