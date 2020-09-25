import React from "react"

const DefaultHaloStyle: React.CSSProperties = {
    fill: "#fff",
    stroke: "#fff",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: ".25em",
}

export const getElementWithHalo = (
    key: string,
    element: React.ReactElement,
    styles: React.CSSProperties = {}
) => {
    const halo = React.cloneElement(element, {
        style: { ...DefaultHaloStyle, ...styles },
    })
    return (
        <React.Fragment key={key}>
            {halo}
            {element}
        </React.Fragment>
    )
}
