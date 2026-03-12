import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { ColorPicker } from "./ColorPicker"
import { ColorDisplay } from "./ColorDisplay"

const VARIANTS: Record<string, React.FC> = {
    picker: ColorPicker,
    display: ColorDisplay,
}

export function mount(
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
): () => void {
    const Component = VARIANTS[opts.variant ?? "picker"]
    if (!Component) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return () => {}
    }

    const root = createRoot(container)
    root.render(createElement(Component))
    return () => root.unmount()
}
