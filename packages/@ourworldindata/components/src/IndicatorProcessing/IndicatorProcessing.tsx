import React from "react"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export interface IndicatorProcessingProps {
    descriptionProcessing: string | undefined
}

export const IndicatorProcessing = (props: IndicatorProcessingProps) => {
    return (
        <div className="indicator-processing">
            <div className="data-processing">
                <p>
                    All data and visualizations on Our World in Data rely on
                    data sourced from one or several original data providers.
                    Preparing this original data involves several processing
                    steps. Depending on the data, this can include standardizing
                    country names and world region definitions, converting
                    units, calculating derived indicators such as per capita
                    measures, as well as adding or adapting metadata such as the
                    name or the description given to an indicator.
                </p>
                <p>
                    At the link below you can find a detailed description of the
                    structure of our data pipeline, including links to all the
                    code used to prepare data across Our World in Data.
                </p>
            </div>
            <a
                href="https://docs.owid.io/projects/etl/"
                target="_blank"
                rel="noopener"
                className="indicator-processing__link"
            >
                Read about our data pipeline
                <FontAwesomeIcon icon={faArrowDown} />
            </a>
            {props.descriptionProcessing && (
                <div className="indicator-processing-callout">
                    <h5 className="indicator-processing-callout__title">
                        Notes on our processing step for this indicator
                    </h5>
                    <div className="indicator-processing-callout__content">
                        <SimpleMarkdownText
                            text={props.descriptionProcessing.trim()}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
