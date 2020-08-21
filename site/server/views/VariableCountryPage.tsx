import * as settings from "settings"
import * as React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { OwidVariableDisplaySettings } from "owidTable/OwidVariable"

export interface VariableCountryPageProps {
    country: {
        id: number
        name: string
    }
    variable: {
        id: number
        name: string
        unit: string
        shortUnit: string
        description: string
        display: OwidVariableDisplaySettings

        datasetId: number
        datasetName: string
        datasetNamespace: string

        source: { id: number; name: string }
    }
}

export const VariableCountryPage = (props: VariableCountryPageProps) => {
    const { variable, country } = props

    const pageTitle = `${country.name} / ${variable.name}`
    const script = `window.runVariableCountryPage(${JSON.stringify(props)})`

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/search`}
                pageTitle={pageTitle}
                pageDesc="Search articles and charts on Our World in Data."
            />
            <body className="VariableCountryPage">
                <SiteHeader />
                <main>{variable.name}</main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
