import * as React from "react"
import { Color } from "@ourworldindata/types"

// The default ratio between a text's font size and the halo's outline width
const TEXT_OUTLINE_FACTOR = 0.25

interface HaloProps {
    id: string
    children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
    show?: boolean
    outlineColor?: Color
    outlineWidth?: number
    fontSize?: number // Derives the outline width from the given font size
    style?: React.CSSProperties
}

const defaultHaloStyle: React.CSSProperties = {
    fill: "#fff",
    stroke: "#fff",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    userSelect: "none",
}

export function Halo(props: HaloProps): React.ReactElement {
    const show = props.show ?? true
    if (!show) return props.children

    const outlineWidth =
        props.outlineWidth ??
        (props.fontSize !== undefined
            ? TEXT_OUTLINE_FACTOR * props.fontSize
            : 2)

    const defaultStyle = {
        ...defaultHaloStyle,
        strokeWidth: outlineWidth,
        fill: props.outlineColor ?? defaultHaloStyle.fill,
        stroke: props.outlineColor ?? defaultHaloStyle.stroke,
    }
    const halo = React.cloneElement(props.children, {
        id: props.id,
        style: {
            ...defaultStyle,
            ...props.style,
        },
    })
    return (
        <React.Fragment key={props.id}>
            {halo}
            {props.children}
        </React.Fragment>
    )
}
