import * as React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { VariableCountryPageProps } from "./VariableCountryPageProps"

export const VariableCountryPage = (props: VariableCountryPageProps) => {
    const { variable, country, baseUrl } = props

    const pageTitle = `${country.name} / ${variable.name}`
    const script = `window.runVariableCountryPage(${JSON.stringify(props)})`

    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/search`}
                pageTitle={pageTitle}
                pageDesc="Search articles and charts on Our World in Data."
            />
            <body className="VariableCountryPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>{variable.name}</main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
