import * as React from "react"
import { Color } from "@ourworldindata/types"

interface HaloProps {
    id: string
    children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
    show?: boolean
    outlineWidth: number
    outlineColor?: Color
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

    const defaultStyle = {
        ...defaultHaloStyle,
        strokeWidth: props.outlineWidth,
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
