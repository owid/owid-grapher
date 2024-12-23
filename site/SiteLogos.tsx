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
                    <picture>
                        <source
                            type="image/avif"
                            srcSet={`${baseUrl}/oms-logo.avif`}
                        />
                        <img
                            src={`${baseUrl}/oms-logo.png`}
                            alt="Oxford Martin School logo"
                            loading="lazy"
                            width={275}
                            height={139}
                        />
                    </picture>
                </a>
                <a
                    href="https://global-change-data-lab.org/"
                    className="gcdl-logo"
                >
                    <picture>
                        <source
                            type="image/webp"
                            srcSet={`${baseUrl}/gcdl-logo.webp`}
                        />
                        <img
                            src={`${baseUrl}/gcdl-logo.png`}
                            alt="Global Change Data Lab logo"
                            loading="lazy"
                            width={106}
                            height={127}
                        />
                    </picture>
                </a>
            </div>
        </div>
    )
}
