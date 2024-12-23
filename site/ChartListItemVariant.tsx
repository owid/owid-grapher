import { BasicChartInformation } from "@ourworldindata/utils"

export const ChartListItemVariant = ({
    chart,
}: {
    chart: BasicChartInformation
}) => {
    return (
        <li>
            <a href={`/grapher/${chart.slug}`}>{chart.title}</a>
            {chart.variantName ? (
                <span className="variantName">{chart.variantName}</span>
            ) : null}
        </li>
    )
}
