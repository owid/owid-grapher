import React from "react"

const HaloStyle: React.CSSProperties = {
    fill: "#fff",
    stroke: "#fff",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: ".2em"
}

export const getElementWithHalo = (element: React.ReactElement) => {
    const halo = React.cloneElement(element, {
        key: `${element.props.key}Halo`,
        style: HaloStyle
    })
    return (
        <React.Fragment>
            {halo}
            {element}
        </React.Fragment>
    )
}
