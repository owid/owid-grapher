import { GrapherAnalytics } from "grapher/core/GrapherAnalytics" // todo: make these less tightly coupled
import { ENV, GRAPHER_VERSION } from "settings"

export class SiteAnalytics extends GrapherAnalytics {
    constructor(environment = ENV, version = GRAPHER_VERSION) {
        super(environment, version)
    }

    logCovidCountryProfileSearch(country: string) {
        this.logToGA("COVID_COUNTRY_PROFILE_SEARCH", country)
    }

    logPageNotFoundError(url: string) {
        this.logToAmplitude("NOT_FOUND", { href: url })
        this.logToGA("Errors", "NotFound", url)
    }

    logChartsPageSearchQuery(query: string) {
        this.logToGA("ChartsPage", "Filter", query)
    }

    logPageLoad() {
        this.logToAmplitude("OWID_PAGE_LOAD")
    }
}
