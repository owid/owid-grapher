import React from "react"

export const SiteLogos = ({ baseUrl }: { baseUrl: string }) => {
    return (
        <div className="site-logos">
            <div className="logo-owid">
                <a href="/">
                    Our World
                    <br /> in Data
                </a>
            </div>
            <div className="logos-wrapper">
                <a
                    href="https://www.oxfordmartin.ox.ac.uk/global-development"
                    className="oxford-logo"
                >
                    <img
                        src={`${baseUrl}/oms-logo.svg`}
                        alt="Oxford Martin School logo"
                    />
                </a>
                <a
                    href="https://global-change-data-lab.org/"
                    className="gcdl-logo"
                >
                    <img
                        src={`${baseUrl}/gcdl-logo.svg`}
                        alt="Global Change Data Lab logo"
                    />
                </a>
            </div>
        </div>
    )
}
