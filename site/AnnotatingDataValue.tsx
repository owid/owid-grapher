import React from "react"
import ReactDOM from "react-dom"
import { Grapher } from "../grapher/core/Grapher"
import { DataValue, DataValueProps } from "./DataValue"

const AnnotatingDataValue_name = "AnnotatingDataValue"

export const AnnotatingDataValue = ({
    dataValueProps,
    grapherInstance,
}: {
    dataValueProps: DataValueProps
    grapherInstance?: Grapher
}) => {
    const onClick = () => {
        grapherInstance?.renderAnnotation({
            entityName: dataValueProps.entityName,
            year: Number(dataValueProps.year),
        })
    }

    return (
        <span className="annotating-data-value">
            <script
                data-type={AnnotatingDataValue_name}
                type="component/props"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(dataValueProps),
                }}
            ></script>
            <button onClick={onClick}>
                <DataValue {...dataValueProps}></DataValue>
            </button>
        </span>
    )
}

export function runAnnotatingDataValue(
    grapherInstance: Grapher,
    figure: Element
) {
    // todo: handle more layouts
    const annotatingDataValueConfigInPreviousColumn:
        | NodeListOf<Element>
        | undefined = figure
        ?.closest(".wp-block-column")
        ?.previousElementSibling?.querySelectorAll(
            `[data-type=${AnnotatingDataValue_name}]`
        )
    annotatingDataValueConfigInPreviousColumn?.forEach((config) => {
        const dataValueProps = JSON.parse(config.innerHTML)
        ReactDOM.hydrate(
            <AnnotatingDataValue
                dataValueProps={dataValueProps}
                grapherInstance={grapherInstance}
            />,
            config.parentElement
        )
    })
}
