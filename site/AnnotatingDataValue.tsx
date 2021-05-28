import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useEffect, useState } from "react"
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
    const [isInteractive, setInteractive] = useState(false)

    const renderAnnotationInGrapher = () => {
        grapherInstance?.renderAnnotation({
            entityName: dataValueProps.entityName,
            year: Number(dataValueProps.year),
        })
    }

    useEffect(() => {
        setInteractive(true)
    }, [])

    return (
        <span className="annotating-data-value">
            <script
                data-type={AnnotatingDataValue_name}
                type="component/props"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(dataValueProps),
                }}
            ></script>
            <span
                onMouseEnter={renderAnnotationInGrapher}
                onMouseLeave={grapherInstance?.resetAnnotation}
                className={isInteractive ? "interactive" : ""}
            >
                {isInteractive ? <FontAwesomeIcon icon={faChartLine} /> : null}
                <DataValue {...dataValueProps}></DataValue>
            </span>
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
