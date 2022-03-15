export function getModuleDefault<T>(module: T): T {
    return ((module as any).default as T) ?? module
}

import _AnimateHeight from "react-animate-height"
import _ReactSelect from "react-select"
import _TippyReact from "@tippyjs/react"

export const AnimateHeight = getModuleDefault(_AnimateHeight)
export const ReactSelect = getModuleDefault(_ReactSelect)
export const TippyReact = getModuleDefault(_TippyReact)
