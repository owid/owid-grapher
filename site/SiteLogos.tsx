export const OxfordAndGcdlLogos = () => (
    <>
        <a href="https://www.oxfordmartin.ox.ac.uk/global-development">
            <img
                src={"/oms-logo.svg"}
                alt="Oxford Martin School logo"
                loading="lazy"
                width={96}
                height={103}
            />
        </a>
        <a href="https://www.ox.ac.uk/">
            <img
                src={"/oxford-logo.svg"}
                alt="University of Oxford logo"
                loading="lazy"
                width={96}
                height={103}
            />
        </a>
        <a href="https://global-change-data-lab.org/">
            <img
                src={"/gcdl-logo.svg"}
                alt="Global Change Data Lab logo"
                loading="lazy"
                width={80}
                height={103}
            />
        </a>
    </>
)

export const SiteLogos = () => {
    return (
        <div className="site-logos">
            <div className="logo-owid">
                <a href="/">
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
