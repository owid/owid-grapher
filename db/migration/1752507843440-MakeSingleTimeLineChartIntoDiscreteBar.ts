import { MigrationInterface, QueryRunner } from "typeorm"

// List of fake discrete bar charts that are actually of type LineChart
// but only have data for a single year, which is why they always appear
// as discrete bar chart. These slugs are the result of checking
// `grapher.times.length <= 1` for all line charts.
const slugs = [
    "adult-population-covered-in-primary-data-on-the-prevalence-of-major-depression",
    "adult-population-covered-in-primary-data-on-the-prevalence-of-mental-illnesses",
    "african-elephant-carcass-ratio",
    "agri-environmental-policies-intensity",
    "animal-lives-lost-direct",
    "animal-lives-lost-total",
    "antibiotic-usage-in-livestock",
    "antibiotic-use-livestock-tonnes",
    "cantril-ladder-age-groups",
    "capital-city-population",
    "carbon-footprint-travel-mode",
    "co2-deforestation-for-food",
    "commodity-deforestation-by-region",
    "cost-calorie-sufficient-diet-share-food-expenditure",
    "cost-calorie-sufficient-diet",
    "cost-healthy-diet-share-food-expenditure",
    "cost-nutritionally-adequate-diet",
    "cost-nutritious-diet-share-food-expenditure",
    "countries-that-adopt-guarantees-for-public-access-to-information",
    "countries-with-national-adaptation-plans-for-climate-change",
    "coverage-of-wetlands",
    "cumulative-number-artificial-intelligence-bills-passed",
    "death-rate-ambient-air-pollution",
    "death-rate-from-snakebite-envenoming",
    "death-rate-household-air-pollution",
    "death-rate-household-and-ambient-air-pollution",
    "deaths-averted-due-to-rotavirus-vaccine",
    "deaths-from-snakebite-envenoming",
    "deforestation-co2-trade-by-product",
    "disaster-events-missing-data",
    "drivers-of-recovery-in-european-bird-populations",
    "emission-factors-food-transport",
    "excess-nitrogen-per-hectare",
    "excess-phosphorous-per-hectare",
    "excess-phosphorous",
    "fish-discard-rates-gear",
    "fish-discards-gear",
    "food-transport-emissions",
    "ghg-per-kg-poore",
    "global-tuberculosis-incidence-rate-by-age",
    "habitat-loss-25-species",
    "households-air-conditioning",
    "infants-pre-term-share",
    "jobs-and-personal-contacts-europe",
    "kilograms-meat-per-animal",
    "lives-saved-vaccines-region",
    "living-languages",
    "mainstreaming-sustainable-development-into-curricula",
    "mainstreaming-sustainable-development-into-student-assessment",
    "mainstreaming-sustainable-development-into-teacher-education",
    "maize-attainable-yield",
    "mortality-rate-attributable-to-wash",
    "most-common-waste-rivers-oceans",
    "nationally-determined-contributions",
    "nitrogen-inputs-per-hectare",
    "number-agri-environmental-policies",
    "number-calorie-diet-unaffordable",
    "number-countries-mandatory-vaccination",
    "number-nutritional-diet-unaffordable",
    "number-of-countries-with-primary-data-on-prevalence-of-mental-illnesses-in-the-global-burden-of-disease-study",
    "number-of-described-species",
    "number-seized-rhino-horns",
    "number-species-evaluated-iucn",
    "number-species-threatened",
    "ocean-waste-by-item",
    "pain-broiler-chickens",
    "pain-levels-hen-systems",
    "per-capita-co2-food-deforestation",
    "phosphorous-inputs-per-hectare",
    "plastic-waste-polymer",
    "plastics-great-pacific-garbage-patch",
    "plastics-top-rivers",
    "pollution-deaths-from-fossil-fuels",
    "population-with-alcohol-use-disorders",
    "projected-cropland-by-2050",
    "projected-habitat-loss-extent-bau",
    "proportion-of-unemployed-using-friends-relatives-trade-unions-in-job-search",
    "proportion-of-unemployed-using-specific-search-methods",
    "rate-of-new-cervical-cancer-cases-gco",
    "region-share-tropical-deforestation",
    "seized-rhino-horns",
    "self-reported-freedom",
    "self-reported-hopefulness",
    "share-believe-climate",
    "share-calorie-diet-unaffordable",
    "share-food-lost-type",
    "share-global-excess-nitrogen",
    "share-global-excess-phosphorous",
    "share-nutritional-diet-unaffordable",
    "share-of-all-cancer-deaths-attributable-to-alcohol-use",
    "share-of-cancer-deaths-attributed-to-alcohol-use-by-type",
    "share-of-cancers-attributed-to-9-hpv-types",
    "share-of-global-mismanaged-plastic-waste",
    "share-of-global-plastic-waste-emitted-to-the-ocean",
    "share-of-industrial-wastewater-which-is-treated",
    "share-of-new-cancers-caused-by-all-known-infections-by-type",
    "share-of-new-cancers-caused-by-all-known-infectious-agents",
    "share-of-new-cancers-caused-by-helicobacter-pylori-bacteria",
    "share-of-people-who-feel-close-to-at-least-one-person",
    "share-of-people-who-recently-donated-to-charity",
    "share-of-people-who-recently-volunteered",
    "share-of-species-evaluated-iucn",
    "share-of-women-who-experienced-violence-by-an-intimate-partner-un",
    "share-species-traded",
    "share-threatened-species",
    "share-who-report-lifetime-anxiety-or-depression",
    "share-who-say-its-extremely-important-for-the-national-government-to-fund-research-on-anxietydepression",
    "support-policies-climate",
    "support-political-climate-action",
    "support-public-action-climate",
    "the-missing-middle-in-the-us-job-growth-is-highest-in-the-top-fifth-and-bottom-fifth-of-occupations-by-mean-annual-earnings",
    "threatened-mammal-species",
    "total-applied-phosphorous-crops",
    "total-nitrogen-inputs-crops",
    "tuberculosis-cases-attributable-to-risk-factors",
    "use-of-statins-for-primary-prevention-of-cardiovascular-disease",
    "use-of-statins-for-secondary-prevention-amongst-eligibible-individuals",
    "waste-items-ocean-region",
    "weather-forecast-spending",
    "women-informed-decisions-health-sexual-relations",
]

export class MakeSingleTimeLineChartIntoDiscreteBar1752507843440
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
                UPDATE chart_configs cc
                SET
                    cc.full = JSON_SET(cc.full, '$.chartTypes', JSON_ARRAY('DiscreteBar')),
                    cc.patch = JSON_SET(cc.patch, '$.chartTypes', JSON_ARRAY('DiscreteBar'))
                WHERE
                    cc.full ->> '$.isPublished' = 'true'
                    AND cc.slug IN (?)
            `,
            [slugs]
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
                UPDATE chart_configs cc
                SET
                    cc.full = JSON_SET(cc.full, '$.chartTypes', JSON_ARRAY('LineChart')),
                    cc.patch = JSON_SET(cc.patch, '$.chartTypes', JSON_ARRAY('LineChart'))
                WHERE
                    cc.full ->> '$.isPublished' = 'true'
                    AND cc.slug IN (?)
            `,
            [slugs]
        )
    }
}
