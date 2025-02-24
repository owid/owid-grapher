export const OxfordAndGcdlLogos = ({ baseUrl }: { baseUrl: string }) => (
    <>
        <a href="https://www.oxfordmartin.ox.ac.uk/global-development">
            <img
                src={`${baseUrl}/oms-logo.svg`}
                alt="Oxford Martin School logo"
                loading="lazy"
                width={96}
                height={103}
            />
        </a>
        <a href="https://www.ox.ac.uk/">
            <img
                src={`${baseUrl}/oxford-logo.svg`}
                alt="University of Oxford logo"
                loading="lazy"
                width={96}
                height={103}
            />
        </a>
        <a href="https://global-change-data-lab.org/">
            <img
                src={`${baseUrl}/gcdl-logo.svg`}
                alt="Global Change Data Lab logo"
                loading="lazy"
                width={80}
                height={103}
            />
        </a>
    </>
)

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
                <OxfordAndGcdlLogos baseUrl={baseUrl} />
            </div>
        </div>
    )
}
