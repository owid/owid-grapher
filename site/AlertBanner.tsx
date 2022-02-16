import React from "react"

export const AlertBanner = () => {
    return (
        <div className="alert-banner">
            <div className="content">
                <div className="text">
                    <strong>Updated daily</strong>
                </div>
                <a
                    href="/covid-vaccinations"
                    data-track-note="covid-banner-click"
                >
                    View our work on COVID-19 vaccinations
                </a>
            </div>
        </div>
    )
}
