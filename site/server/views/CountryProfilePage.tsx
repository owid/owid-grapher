import * as settings from "settings"
import * as React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import urljoin from "url-join"

export interface CountryProfileIndicator {
    name: string
    slug: string
    value: string
    year: number
    variantName?: string
}

export interface Stat {
    value: number
    year: number
}

export interface CountryProfileKeyStats {
    population: Stat
}

export interface CountryProfilePageProps {
    country: {
        name: string
        slug: string
        code: string
    }
    indicators: CountryProfileIndicator[]
}

export const CountryProfilePage = (props: CountryProfilePageProps) => {
    const { country, indicators } = props

    // const displayName = defaultTo(variable.display.name, variable.name)

    const script = `window.runCountryProfilePage()`

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/country/${country.slug}`}
                pageTitle={`${country.name}`}
                pageDesc={`Population, GDP, life expectancy, birth rate and other key metrics for ${country.name}.`}
            />
            <body className="CountryProfilePage">
                <SiteHeader />
                <main>
                    <header>
                        <img
                            className="flag"
                            src={`/images/flags/${country.code}.svg`}
                        />
                        <h1>{country.name}</h1>
                    </header>
                    {/* <ul className="keyStats">
                    <li>
                        <span>Population, persons:</span> {keyStats.population.value} ({keyStats.population.year})
                    </li>
                </ul> */}
                    <div>
                        <input
                            type="search"
                            className="chartsSearchInput"
                            placeholder={`Filter ${indicators.length} indicators for ${country.name}`}
                        />
                    </div>
                    <section>
                        <ul className="indicators">
                            {indicators.map((indicator) => (
                                <li key={indicator.slug}>
                                    <div className="indicatorName">
                                        <a
                                            href={urljoin(
                                                settings.BAKED_BASE_URL,
                                                indicator.slug
                                            )}
                                        >
                                            {indicator.name}
                                            {indicator.variantName
                                                ? " (" +
                                                  indicator.variantName +
                                                  ")"
                                                : ""}
                                        </a>
                                    </div>
                                    <div className="indicatorValue">
                                        {indicator.value} ({indicator.year})
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                </main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
