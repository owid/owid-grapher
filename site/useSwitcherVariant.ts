import { useEffect, useState } from "react"

// Feature flag for which indicator-switcher UI to render on multi-indicator
// data pages. Override per-request via the URL query string,
// e.g. `?switcher=h-tabs` or `?switcher=v-tabs`.
export type SwitcherVariant = "dropdown" | "h-tabs" | "v-tabs" | "h-pills"

const DEFAULT_SWITCHER_VARIANT: SwitcherVariant = "h-pills"
const ALL_SWITCHER_VARIANTS: readonly SwitcherVariant[] = [
    "dropdown",
    "h-tabs",
    "v-tabs",
    "h-pills",
]

export const useSwitcherVariant = (): SwitcherVariant => {
    const [variant, setVariant] = useState<SwitcherVariant>(
        DEFAULT_SWITCHER_VARIANT
    )
    useEffect(() => {
        if (typeof window === "undefined") return
        const sp = new URLSearchParams(window.location.search)
        const v = sp.get("switcher")
        if (v && ALL_SWITCHER_VARIANTS.includes(v as SwitcherVariant)) {
            setVariant(v as SwitcherVariant)
        }
    }, [])
    return variant
}
