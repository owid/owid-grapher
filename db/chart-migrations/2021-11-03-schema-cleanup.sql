update charts
set config = JSON_REMOVE(config, '$."map"."isColorblind"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."isColorblind"') = 1;

update charts
set config = JSON_REMOVE(config, '$."variables"')
where JSON_CONTAINS_PATH(config, 'one', '$."variables"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."timelineMode"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."timelineMode"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."minYear"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."minYear"') = 1;

update charts
set config = JSON_REMOVE(config, '$."chart-notes"')
where JSON_CONTAINS_PATH(config, 'one', '$."chart-notes"') = 1;

update charts
set config = JSON_REMOVE(config, '$."iframe-height"')
where JSON_CONTAINS_PATH(config, 'one', '$."iframe-height"') = 1;

update charts
set config = JSON_REMOVE(config, '$."/charts/255"')
where JSON_CONTAINS_PATH(config, 'one', '$."/charts/255"') = 1;

update charts
set config = JSON_REMOVE(config, '$."iframe-width"')
where JSON_CONTAINS_PATH(config, 'one', '$."iframe-width"') = 1;

update charts
set config = JSON_REMOVE(config, '$."activeLegendKeys"')
where JSON_CONTAINS_PATH(config, 'one', '$."activeLegendKeys"') = 1;

update charts
set config = JSON_REMOVE(config, '$."chart-name"')
where JSON_CONTAINS_PATH(config, 'one', '$."chart-name"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."mode"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."mode"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."targetYearMode"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."targetYearMode"') = 1;

update charts
set config = JSON_REMOVE(config, '$."useV2"')
where JSON_CONTAINS_PATH(config, 'one', '$."useV2"') = 1;

update charts
set config = JSON_REMOVE(config, '$."yAxis"."labelDistance"')
where JSON_CONTAINS_PATH(config, 'one', '$."yAxis"."labelDistance"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."legendOrientation"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."legendOrientation"') = 1;

update charts
set config = JSON_REMOVE(config, '$."/charts/29"')
where JSON_CONTAINS_PATH(config, 'one', '$."/charts/29"') = 1;

update charts
set config = JSON_REMOVE(config, '$."isExplorable"')
where JSON_CONTAINS_PATH(config, 'one', '$."isExplorable"') = 1;

update charts
set config = JSON_REMOVE(config, '$."lastEditedAt"')
where JSON_CONTAINS_PATH(config, 'one', '$."lastEditedAt"') = 1;

update charts
set config = JSON_REMOVE(config, '$."timeline"')
where JSON_CONTAINS_PATH(config, 'one', '$."timeline"') = 1;

update charts
set config = JSON_REMOVE(config, '$."published"')
where JSON_CONTAINS_PATH(config, 'one', '$."published"') = 1;

update charts
set config = JSON_REMOVE(config, '$."group-by-variables"')
where JSON_CONTAINS_PATH(config, 'one', '$."group-by-variables"') = 1;

update charts
set config = JSON_REMOVE(config, '$."margins"')
where JSON_CONTAINS_PATH(config, 'one', '$."margins"') = 1;

update charts
set config = JSON_REMOVE(config, '$."add-country-control"')
where JSON_CONTAINS_PATH(config, 'one', '$."add-country-control"') = 1;

update charts
set config = JSON_REMOVE(config, '$."logos"')
where JSON_CONTAINS_PATH(config, 'one', '$."logos"') = 1;

update charts
set config = JSON_REMOVE(config, '$."units"')
where JSON_CONTAINS_PATH(config, 'one', '$."units"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."defaultProjection"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."defaultProjection"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."legendStepSize"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."legendStepSize"') = 1;

update charts
set config = JSON_REMOVE(config, '$."identityLine"')
where JSON_CONTAINS_PATH(config, 'one', '$."identityLine"') = 1;

update charts
set config = JSON_REMOVE(config, '$."isAutoSlug"')
where JSON_CONTAINS_PATH(config, 'one', '$."isAutoSlug"') = 1;

update charts
set config = JSON_REMOVE(config, '$."onlyEntityMatch"')
where JSON_CONTAINS_PATH(config, 'one', '$."onlyEntityMatch"') = 1;

update charts
set config = JSON_REMOVE(config, '$."isAutoTitle"')
where JSON_CONTAINS_PATH(config, 'one', '$."isAutoTitle"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."colorSchemeName"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."colorSchemeName"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."timeRanges"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."timeRanges"') = 1;

update charts
set config = JSON_REMOVE(config, '$."highlightToggle"."object"')
where JSON_CONTAINS_PATH(config, 'one', '$."highlightToggle"."object"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."defaultYear"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."defaultYear"') = 1;

update charts
set config = JSON_REMOVE(config, '$."chart-slug"')
where JSON_CONTAINS_PATH(config, 'one', '$."chart-slug"') = 1;

update charts
set config = JSON_REMOVE(config, '$."map"."maxYear"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."maxYear"') = 1;


-- second batch

update charts
set config = JSON_REMOVE(config, '$."map"."timeInterval"')
where JSON_CONTAINS_PATH(config, 'one', '$."map"."timeInterval"') = 1;

update charts
set config = JSON_REMOVE(config, '$."xAxis"."labelDistance"')
where JSON_CONTAINS_PATH(config, 'one', '$."xAxis"."labelDistance"') = 1;


update charts
set config = JSON_SET(config, '$.map.targetYear', convert(config->>"$.map.targetYear", signed integer))
where JSON_TYPE(JSON_EXTRACT(config, '$.map.targetYear')) = 'STRING' and
JSON_EXTRACT(config, '$.map.targetYear') <> "latest"


update charts
set config = JSON_SET(config, '$.stackMode', null)
where JSON_EXTRACT(config, '$.stackMode') = ''

update charts
set config = JSON_REMOVE(config, '$."highlightToggle"')
where JSON_CONTAINS_PATH(config, 'one', '$.highlightToggle ') = 1 and JSON_TYPE(JSON_EXTRACT(config, '$.highlightToggle')) = 'NULL'


-- third batch
-- these fields are now objects but some older configs had array. These can't be parsed correctly anymore so we drop them.

update charts
set config = JSON_REMOVE(config, '$.map.colorScale.customCategoryColors')
where JSON_CONTAINS_PATH(config, 'one', '$.map.colorScale.customCategoryColors') = 1
and JSON_TYPE(JSON_EXTRACT(config, '$.map.colorScale.customCategoryColors')) = 'ARRAY'

update charts
set config = JSON_REMOVE(config, '$.map.colorScale.customHiddenCategories')
where JSON_CONTAINS_PATH(config, 'one', '$.map.colorScale.customHiddenCategories') = 1
and JSON_TYPE(JSON_EXTRACT(config, '$.map.colorScale.customHiddenCategories')) = 'ARRAY'

update charts
set config = JSON_REMOVE(config, '$.map.colorScale.customCategoryLabels')
where JSON_CONTAINS_PATH(config, 'one', '$.map.colorScale.customCategoryLabels') = 1
and JSON_TYPE(JSON_EXTRACT(config, '$.map.colorScale.customCategoryLabels')) = 'ARRAY'
