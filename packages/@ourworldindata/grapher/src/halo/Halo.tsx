import React from "react"

const defaultHaloStyle: React.CSSProperties = {
    fill: "#fff",
    stroke: "#fff",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: ".25em",
    userSelect: "none",
}

export function Halo(props: {
    key: React.Key
    children: React.ReactElement
    style?: React.CSSProperties
}): React.ReactElement {
    const halo = React.cloneElement(props.children, {
        style: { ...defaultHaloStyle, ...props.style },
    })
    return (
        <React.Fragment key={props.key}>
            {halo}
            {props.children}
        </React.Fragment>
    )
}
