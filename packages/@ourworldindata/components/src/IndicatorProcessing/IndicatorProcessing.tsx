import React from "react"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

export interface IndicatorProcessingProps {
    descriptionProcessing: string | undefined
}

export const IndicatorProcessing = (props: IndicatorProcessingProps) => {
    return (
        <div className="indicator-processing">
            <div className="data-processing__content">
                <p className="data-processing__paragraph">
                    All data and visualizations on Our World in Data rely on
                    data sourced from one or several original data providers.
                    Preparing this original data involves several processing
                    steps. Depending on the data, this can include standardizing
                    country names and world region definitions, converting
                    units, calculating derived indicators such as per capita
                    measures, as well as adding or adapting metadata such as the
                    name or the description given to an indicator.
                </p>
                <p className="data-processing__paragraph">
                    At the link below you can find a detailed description of the
                    structure of our data pipeline, including links to all the
                    code used to prepare data across Our World in Data.
                </p>
            </div>
            <a
                href="https://docs.owid.io/projects/etl/"
                target="_blank"
                rel="nopener noreferrer"
                className="data-processing__link"
            >
                Read about our data pipeline
            </a>
            {props.descriptionProcessing && (
                <div className="variable-processing-info">
                    <h5 className="variable-processing-info__header">
                        Notes on our processing step for this indicator
                    </h5>
                    <div className="variable-processing-info__description">
                        <SimpleMarkdownText
                            text={props.descriptionProcessing}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
