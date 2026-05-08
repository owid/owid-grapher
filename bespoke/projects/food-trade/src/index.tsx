import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { VariantName } from "./constants.js"
import { Placeholder } from "./components/Placeholder"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

const queryClient = new QueryClient()

function PlaceholderWithProviders() {
    return (
        <QueryClientProvider client={queryClient}>
            <Placeholder />
        </QueryClientProvider>
    )
}

export const VARIANTS = [
    { name: "main", component: PlaceholderWithProviders, demoConfig: {} },
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
