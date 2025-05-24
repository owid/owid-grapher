import { BAKED_BASE_URL } from "../settings/clientSettings.js"

// The BAKED_BASE_URL is necessary to make the data page previews work when they
// are served dynamically from the admin, which runs on a different domain.
export const OxfordAndGcdlLogos = () => (
    <>
        <a href="https://www.oxfordmartin.ox.ac.uk/global-development">
            <img
                src={`${BAKED_BASE_URL}/oms-logo.svg`}
                alt="Oxford Martin School logo"
                loading="lazy"
                width={96}
                height={103}
            />
        </a>
        <a href="https://www.ox.ac.uk/">
            <img
                src={`${BAKED_BASE_URL}/oxford-logo.svg`}
                alt="University of Oxford logo"
                loading="lazy"
                width={96}
                height={103}
            />
        </a>
        <a href="https://global-change-data-lab.org/">
            <img
                src={`${BAKED_BASE_URL}/gcdl-logo.svg`}
                alt="Global Change Data Lab logo"
                loading="lazy"
                width={80}
                height={103}
            />
        </a>
    </>
)

export const SiteLogos = ({ homeUrl = "/" }: { homeUrl?: string }) => {
    return (
        <div className="site-logos">
            <div className="logo-owid">
                <a href={homeUrl}>
                    Our World
                    <br /> in Data
                </a>
            </div>
            <div className="logos-wrapper">
                <OxfordAndGcdlLogos />
            </div>
        </div>
    )
}
