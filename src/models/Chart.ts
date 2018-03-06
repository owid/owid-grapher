import * as db from '../db'

export default class Chart {
    static listFields = `
        charts.id,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.title")) AS title,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.slug")) AS slug,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.type")) AS type,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.internalNotes")) AS internalNotes,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.isPublished")) AS isPublished,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.tab")) AS tab,
        JSON_EXTRACT(charts.config, "$.hasChartTab") = true AS hasChartTab,
        JSON_EXTRACT(charts.config, "$.hasMapTab") = true AS hasMapTab,
        charts.starred AS isStarred,
        charts.last_edited_at AS lastEditedAt,
        charts.last_edited_by AS lastEditedBy,
        charts.published_at AS publishedAt,
        charts.published_by AS publishedBy
    `
}