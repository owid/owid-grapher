import {
    CHART_LICENSES,
    DEFAULT_CHART_LICENSE,
    LicenseOption,
} from "@ourworldindata/types"

// The license blurb shown in the "Reuse this work" section of data pages.
// Charts default to CC BY; a stricter license can be set in the chart config
// when a data provider requires it.
export function ChartLicenseNotice({
    license = DEFAULT_CHART_LICENSE,
}: {
    license?: LicenseOption
}) {
    const ccBy = CHART_LICENSES[DEFAULT_CHART_LICENSE]

    if (license === DEFAULT_CHART_LICENSE)
        return (
            <>
                All data, visualizations, and code produced by Our World in Data
                are completely open access under the{" "}
                <a href={ccBy.url}>Creative Commons BY license</a>. You have the
                permission to use, distribute, and reproduce these in any
                medium, provided the source and authors are credited.
            </>
        )

    const chartLicense = CHART_LICENSES[license]
    return (
        <>
            The visualization on this page is licensed under the{" "}
            <a href={chartLicense.url}>
                Creative Commons {chartLicense.name.replace(/^CC /, "")} license
            </a>
            , in line with the license terms of the data provider.
        </>
    )
}
