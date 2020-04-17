import * as React from "react"

export const AlertBanner = () => {
    return (
        <div className="alert-banner">
            <div className="content">
                <div className="text">
                    <strong>Coronavirus pandemic</strong>: daily updated
                    research and data.
                </div>
                <a href="/coronavirus">Read more</a>
            </div>
        </div>
    )
}
