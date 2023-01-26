import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import urljoin from "url-join"

export interface CountryProfileIndicator {
    name: string
    slug: string
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
    baseUrl: string
}

export const CountryProfilePage = (props: CountryProfilePageProps) => {
    const { country, indicators, baseUrl } = props

    // const displayName = defaultTo(variable.display.name, variable.name)

    const script = `window.runCountryProfilePage()`

    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/country/${country.slug}`}
                pageTitle={`${country.name}`}
                pageDesc={`Population, GDP, life expectancy, birth rate and other key metrics for ${country.name}.`}
                baseUrl={baseUrl}
            />
            <body className="CountryProfilePage">
                <SiteHeader baseUrl={baseUrl} />
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
                    <p>
                        Below are all indicators in our database for which this
                        country has a value.
                    </p>
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
                                                baseUrl,
                                                indicator.slug
                                            )}
                                        >
                                            {indicator.name}
                                        </a>
                                        {indicator.variantName && (
                                            <span className="variantName">
                                                {indicator.variantName}
                                            </span>
                                        )}
                                    </div>
                                    <div className="indicatorValue">
                                        ({indicator.year})
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                </main>
                <SiteFooter baseUrl={baseUrl} />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{ __html: script }}
                />
            </body>
        </html>
    )
}
