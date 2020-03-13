import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"

export const CovidBanner = () => {
    return (
        <div className="covid-banner">
            <a href="/coronavirus">
                Our up to date work on{" "}
                <strong>
                    Coronavirus Disease (COVID-19) – Research and Statistics
                </strong>
                <FontAwesomeIcon icon={faArrowRight} />
            </a>
        </div>
    )
}
