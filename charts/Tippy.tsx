import * as React from "react"
import {
    default as OriginalTippy,
    TippyProps,
    tippy as tippyCore
} from "@tippyjs/react"
// import "tippyjs/dist/tippy.css"
// import "tippyjs/themes/light.css"

export const Tippy = (props: TippyProps) => (
    <OriginalTippy theme="light" {...props} />
)

export { tippyCore }
