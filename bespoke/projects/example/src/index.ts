import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { ColorPicker } from "./ColorPicker"
import { ColorDisplay } from "./ColorDisplay"

export const VARIANTS = [
    { name: "picker", component: ColorPicker, defaultConfig: {} },
    { name: "display", component: ColorDisplay, defaultConfig: {} },
]

export function mount(
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
): void | (() => void) {
    const variant = VARIANTS.find((v) => v.name === opts.variant)
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    const root = createRoot(container)
    root.render(createElement(variant.component))
    return () => root.unmount()
}
