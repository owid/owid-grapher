import React from "react"

export const AlertBanner = () => {
    return (
        <div className="alert-banner">
            <div className="content">
                <div className="text">
                    <strong>
                        COVID-19 vaccinations, cases, excess mortality, and much
                        more
                    </strong>
                </div>
                <a
                    href="/coronavirus#explore-the-global-situation"
                    data-track-note="covid-banner-click"
                >
                    Explore our COVID-19 data
                </a>
            </div>
        </div>
    )
}
