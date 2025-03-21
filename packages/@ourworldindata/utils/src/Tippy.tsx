import * as React from "react"
import { default as OriginalTippy, TippyProps } from "@tippyjs/react"

interface CustomTippyProps extends TippyProps {
    lazy?: boolean
}

export const Tippy = (props: CustomTippyProps): React.ReactElement => {
    const { lazy, ...tippyProps } = props

    const TippyInstance = lazy ? LazyTippy : OriginalTippy
    return <TippyInstance theme="light" {...tippyProps} />
}

// A Tippy instance that only evaluates `content` when the tooltip is shown.
// Taken from https://gist.github.com/atomiks/520f4b0c7b537202a23a3059d4eec908
// This will hopefully become supported in Tippy itself someday: See https://github.com/atomiks/tippyjs-react/issues/209
export const LazyTippy = (props: TippyProps): React.ReactElement => {
    const [mounted, setMounted] = React.useState(false)

    const lazyPlugin = {
        fn: (): { onMount: () => void; onHidden: () => void } => ({
            onMount: (): void => setMounted(true),
            onHidden: (): void => setMounted(false),
        }),
    }

    const computedProps = { ...props }

    computedProps.plugins = [lazyPlugin, ...(props.plugins || [])]

    if (props.render) {
        const render = props.render // let TypeScript safely derive that render is not undefined
        computedProps.render = (...args): React.ReactNode =>
            mounted ? render(...args) : ""
    } else {
        computedProps.content = mounted ? props.content : ""
    }

    return <Tippy {...computedProps} />
}

interface TippyIfInteractiveProps extends CustomTippyProps {
    isInteractive: boolean
}

// We sometimes need a conditional Tippy instance, i.e. a Tippy that is only hooked up to
// interactive charts (and not in static SVG exports etc.). This is that: If `isInteractive=false`,
// then it bypasses Tippy and just renders the children.
export const TippyIfInteractive = (
    props: TippyIfInteractiveProps
): React.ReactElement => {
    const { isInteractive, ...tippyProps } = props

    if (isInteractive) return <Tippy {...tippyProps} />
    else return <>{props.children}</>
}
