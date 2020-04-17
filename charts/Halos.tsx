import React from "react"

const HaloStyle: React.CSSProperties = {
    fill: "#fff",
    stroke: "#fff",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: ".25em"
}

export const getElementWithHalo = (
    key: string,
    element: React.ReactElement
) => {
    const halo = React.cloneElement(element, {
        style: HaloStyle
    })
    return (
        <React.Fragment key={key}>
            {halo}
            {element}
        </React.Fragment>
    )
}
