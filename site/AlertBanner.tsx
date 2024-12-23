export const AlertBanner = () => {
    // 2023-03-23: This banner is now disabled, since we no longer want to highlight
    // the COVID-19 data this way. If we don't reuse this banner later for something
    // else, we can eventually delete it.
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
                    data-track-note="covid_banner_click"
                >
                    Explore our COVID-19 data
                </a>
            </div>
        </div>
    )
}
