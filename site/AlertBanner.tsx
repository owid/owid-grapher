import React from "react"

export const AlertBanner = () => {
    return (
        <div className="alert-banner">
            <div className="content">
                <div className="text">
                    <strong>In the news</strong>
                </div>
                <a href="/ukraine-war" data-track-note="covid-banner-click">
                    Explore data for context of the war in Ukraine
                </a>
            </div>
        </div>
    )
}
