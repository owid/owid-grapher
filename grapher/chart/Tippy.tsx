import * as React from "react"
import { default as OriginalTippy, TippyProps } from "@tippyjs/react"

export const Tippy = (props: TippyProps): JSX.Element => (
    <OriginalTippy theme="light" {...props} />
)

interface TippyIfInteractiveProps extends TippyProps {
    isInteractive: boolean
}

// We sometimes need a conditional Tippy instance, i.e. a Tippy that is only hooked up to
// interactive charts (and not in static SVG exports etc.). This is that: If `isInteractive=false`,
// then it bypasses Tippy and just renders the children.
export const TippyIfInteractive = (
    props: TippyIfInteractiveProps
): JSX.Element => {
    const { isInteractive, ...tippyProps } = props

    if (isInteractive) return <Tippy {...tippyProps} />
    else return <>{props.children}</>
}
