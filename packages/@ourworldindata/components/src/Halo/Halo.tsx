import * as React from "react"
import { Color } from "@ourworldindata/types"

const defaultHaloStyle: React.CSSProperties = {
    fill: "#fff",
    stroke: "#fff",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    userSelect: "none",
}

export function Halo(props: {
    id: React.Key
    children: React.ReactElement
    show?: boolean
    outlineColor?: Color
    style?: React.CSSProperties
}): React.ReactElement {
    const show = props.show ?? true
    if (!show) return props.children

    const defaultStyle = {
        ...defaultHaloStyle,
        // Figma doesn't support stroke widths using ems, so we use pixels
        // if we can and fallback to ems if we can't
        strokeWidth: props.children.props.fontSize
            ? props.children.props.fontSize * 0.25
            : ".25em",
        fill: props.outlineColor ?? defaultHaloStyle.fill,
        stroke: props.outlineColor ?? defaultHaloStyle.stroke,
    }
    const halo = React.cloneElement(props.children, {
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
