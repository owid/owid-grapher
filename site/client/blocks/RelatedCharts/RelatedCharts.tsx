import * as React from "react"
import * as db from "../../../../db/db"

interface RelatedChart {
    title: string
    slug: string
}

export async function getRelatedCharts(
    postId: number
): Promise<RelatedChart[]> {
    return db.query(`
        SELECT
            charts.config->>"$.slug" AS slug,
            charts.config->>"$.title" AS title
        FROM charts
        INNER JOIN chart_tags ON charts.id=chart_tags.chartId
        INNER JOIN post_tags ON chart_tags.tagId=post_tags.tag_id
        WHERE post_tags.post_id=${postId}
    `)
}

export const RelatedCharts = ({ charts }: { charts: RelatedChart[] }) => {
    return (
        <div className="related-charts">
            <div className="title">Related charts</div>
            <ul>
                {charts.map(chart => (
                    <li>
                        <a href={`/grapher/${chart.slug}`}>{chart.title}</a>
                    </li>
                ))}
            </ul>
        </div>
    )
}
