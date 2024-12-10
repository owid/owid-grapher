import {
    EntitySelectionMode,
    GrapherInterface,
    ScaleType,
    simpleMerge,
} from "@ourworldindata/utils"
import { MigrationInterface, QueryRunner } from "typeorm"

export class MigrateSlopeCharts1733850122191 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const slopeCharts = await queryRunner.query(`
            -- sql
            SELECT c.id, cc.id AS configId, cc.patch, cc.full
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE
                cc.chartType = 'SlopeChart'
                AND cc.full ->> '$.isPublished' = 'true'
        `)

        const configUpdatesById = new Map(
            configUpdates.map(({ id, config }) => [id, config])
        )

        for (const chart of slopeCharts) {
            const migrationConfig = configUpdatesById.get(chart.id)
            if (!migrationConfig) continue

            const patchConfig = JSON.parse(chart.patch)
            const fullConfig = JSON.parse(chart.full)

            const newPatchConfig = simpleMerge(patchConfig, migrationConfig)
            const newFullConfig = simpleMerge(fullConfig, migrationConfig)

            await queryRunner.query(
                `
                -- sql
                UPDATE chart_configs
                SET
                    patch = ?,
                    full = ?
                WHERE id = ?
            `,
                [
                    JSON.stringify(newPatchConfig),
                    JSON.stringify(newFullConfig),
                    chart.configId,
                ]
            )
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}

const configUpdates: { id: number; config: GrapherInterface }[] = [
    {
        id: 414,
        config: {
            selectedEntityNames: [
                "Colombia",
                "Guatemala",
                "Indonesia",
                "Iran",
                "Jamaica",
                "Pakistan",
                "Trinidad and Tobago",
                "Botswana",
                "Bolivia",
                "Japan",
                "United States",
                "Sweden",
                "Germany",
                "Netherlands",
                "Belgium",
                "France",
                "Ireland",
                "United Kingdom",
            ],
            hideRelativeToggle: true,
        },
    },
    {
        id: 415,
        config: {
            selectedEntityNames: [
                "Congenital heart anomalies",
                "Neonatal preterm birth",
                "Neonatal encephalopathy due to birth asphyxia and trauma",
                "Congenital birth defects",
                "Diarrheal diseases",
                "Malaria",
            ],
            entityType: "cause",
            entityTypePlural: "causes",
            hideRelativeToggle: true,
            hideLegend: false,
        },
    },
    {
        id: 679,
        config: {
            selectedEntityNames: [
                "Low-income countries",
                "High-income countries",
                "Lower-middle-income countries",
                "Upper-middle-income countries",
            ],
            hideRelativeToggle: true,
            yAxis: {
                scaleType: ScaleType.linear,
            },
        },
    },
    {
        id: 874,
        config: {
            selectedEntityNames: [
                "North America (WB)",
                "South Asia (WB)",
                "Europe and Central Asia (WB)",
                "Latin America and Caribbean (WB)",
            ],
            hideRelativeToggle: true,
        },
    },
    {
        id: 875,
        config: {
            selectedEntityNames: [
                "India",
                "United States",
                "Indonesia",
                "Pakistan",
                "Nigeria",
            ],
            hideRelativeToggle: true,
        },
    },
    {
        id: 1004,
        config: {
            selectedEntityNames: [
                "Europe (UN)",
                "Asia (UN)",
                "Africa (UN)",
                "Oceania (UN)",
                "Northern America (UN)",
                "Latin America and the Caribbean (UN)",
            ],
        },
    },
    { id: 1459, config: {} },
    {
        id: 1975,
        config: {
            selectedEntityNames: [
                "North America",
                "South America",
                "Europe",
                "Asia",
                "Oceania",
                "Africa",
            ],
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2832,
        config: {
            selectedEntityNames: [
                "Italy",
                "France",
                "Finland",
                "Norway",
                "Estonia",
                "United Kingdom",
                "Spain",
                "Germany",
                "Belgium",
            ],
            hideTimeline: true,
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2833,
        config: {
            selectedEntityNames: [
                "Belgium",
                "Poland",
                "Italy",
                "Germany",
                "Norway",
                "Spain",
                "France",
                "Finland",
                "United Kingdom",
                "Estonia",
            ],
            hideTimeline: true,
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2834,
        config: {
            selectedEntityNames: [
                "Belgium",
                "Italy",
                "Spain",
                "Norway",
                "France",
                "Poland",
                "Estonia",
                "United Kingdom",
                "Finland",
                "Germany",
            ],
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2835,
        config: {
            selectedEntityNames: [
                "Estonia",
                "Norway",
                "Poland",
                "United Kingdom",
                "France",
                "Finland",
                "Germany",
                "Belgium",
                "Italy",
                "Spain",
            ],
            hideTimeline: true,
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2975,
        config: {
            selectedEntityNames: [
                "Germany",
                "Poland",
                "United Kingdom",
                "Finland",
                "Estonia",
                "Spain",
                "Italy",
                "Norway",
                "France",
            ],
            hideTimeline: true,
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2976,
        config: {
            selectedEntityNames: [
                "Poland",
                "Italy",
                "Spain",
                "Estonia",
                "France",
                "Germany",
                "Belgium",
                "United Kingdom",
                "Norway",
                "Finland",
            ],
            hideTimeline: true,
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2977,
        config: {
            selectedEntityNames: [
                "Poland",
                "Norway",
                "Estonia",
                "Finland",
                "Germany",
                "Belgium",
                "United Kingdom",
                "Spain",
                "Italy",
                "France",
            ],
            hideTimeline: true,
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2978,
        config: {
            selectedEntityNames: [
                "Poland",
                "Norway",
                "Belgium",
                "Estonia",
                "Italy",
                "Finland",
                "Germany",
                "United Kingdom",
                "Spain",
                "France",
            ],
            hideTimeline: true,
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 2979,
        config: {
            selectedEntityNames: [
                "United Kingdom",
                "Estonia",
                "Belgium",
                "Italy",
                "France",
                "Spain",
                "Germany",
                "Poland",
                "Finland",
                "Norway",
            ],
            hideTimeline: true,
            addCountryMode: EntitySelectionMode.Disabled,
        },
    },
    {
        id: 3249,
        config: {
            selectedEntityNames: [
                "France",
                "Italy",
                "Japan",
                "Portugal",
                "Germany",
                "Mexico",
                "Norway",
                "Sweden",
                "Taiwan",
                "Sri Lanka",
                "United Kingdom",
                "United States",
            ],
        },
    },
    {
        id: 3359,
        config: {
            selectedEntityNames: [
                "Mali",
                "South Africa",
                "Nigeria",
                "Niger",
                "Chad",
                "Ethiopia",
                "Kenya",
                "Uganda",
                "Rwanda",
                "Burundi",
                "Tanzania",
                "Mozambique",
                "Madagascar",
                "Zambia",
                "Congo",
                "Democratic Republic of Congo",
                "Central African Republic",
                "Cameroon",
                "Togo",
                "Benin",
                "Sierra Leone",
                "Cote d'Ivoire",
                "Burkina Faso",
                "Guinea-Bissau",
                "Papua New Guinea",
                "Senegal",
                "Angola",
            ],
        },
    },
    {
        id: 3364,
        config: {
            selectedEntityNames: [
                "India",
                "Indonesia",
                "United States",
                "Pakistan",
            ],
        },
    },
    {
        id: 3433,
        config: {},
    },
    {
        id: 3434,
        config: {},
    },
    {
        id: 3580,
        config: {
            entityTypePlural: "species",
        },
    },
    {
        id: 3620,
        config: {
            selectedEntityNames: [
                "Low income",
                "High income",
                "Middle income",
                "Low & middle income",
                "Lower middle income",
                "Upper middle income",
            ],
        },
    },
    {
        id: 3627,
        config: {
            selectedEntityNames: [
                "Low income",
                "High income",
                "Middle income",
                "Low & middle income",
                "Lower middle income",
                "Upper middle income",
            ],
            hideTimeline: true,
        },
    },
    {
        id: 4408,
        config: {
            selectedEntityNames: [
                "East Asia (MPD)",
                "Latin America (MPD)",
                "Eastern Europe (MPD)",
                "Western Europe (MPD)",
                "Western offshoots (MPD)",
                "Sub Saharan Africa (MPD)",
                "South and South East Asia (MPD)",
                "Middle East and North Africa (MPD)",
                "World",
            ],
        },
    },
    {
        id: 4764,
        config: {
            entityTypePlural: "species",
        },
    },
    {
        id: 6219,
        config: {
            hideRelativeToggle: true,
        },
    },
    {
        id: 6529,
        config: {
            selectedEntityNames: [
                "North America",
                "Europe",
                "Asia",
                "South America",
                "Oceania",
                "Africa",
            ],
        },
    },
    {
        id: 7150,
        config: {
            selectedEntityNames: [
                "Ethiopia",
                "Myanmar",
                "Niger",
                "Chad",
                "Colombia",
                "Indonesia",
                "Nigeria",
            ],
        },
    },
    {
        id: 7206,
        config: {
            selectedEntityNames: [
                "Americas (excl. USA)",
                "Asia (excl. China and India)",
                "China",
                "Europe",
                "India",
                "Middle East & North Africa",
                "Oceania",
                "Sub-Saharan Africa",
                "United States",
                "World",
            ],
        },
    },
    {
        id: 7220,
        config: {
            selectedEntityNames: [
                "Americas (excl. USA)",
                "Asia (excl. China and India)",
                "China",
                "Europe",
                "India",
                "Middle East & North Africa",
                "Oceania",
                "Sub-Saharan Africa",
                "United States",
                "World",
            ],
        },
    },
    {
        id: 7221,
        config: {
            selectedEntityNames: [
                "Americas (excl. USA)",
                "Asia (excl. China and India)",
                "China",
                "Europe",
                "India",
                "Middle East & North Africa",
                "Oceania",
                "Sub-Saharan Africa",
                "United States",
                "World",
            ],
        },
    },
    {
        id: 7226,
        config: {
            selectedEntityNames: [
                "Americas (excl. USA)",
                "Asia (excl. China and India)",
                "China",
                "Europe",
                "India",
                "Middle East & North Africa",
                "Oceania",
                "Sub-Saharan Africa",
                "United States",
                "World",
            ],
        },
    },
    {
        id: 7344,
        config: {
            selectedEntityNames: [
                "United States",
                "Romania",
                "France",
                "United Kingdom",
                "Colombia",
                "Mexico",
                "Japan",
            ],
        },
    },
    {
        id: 7448,
        config: {
            addCountryMode: EntitySelectionMode.MultipleEntities,
            hideRelativeToggle: true,
        },
    },
    {
        id: 8157,
        config: {
            selectedEntityNames: [
                "South Asia (WB)",
                "North America (WB)",
                "Sub-Saharan Africa (WB)",
                "East Asia and Pacific (WB)",
                "Europe and Central Asia (WB)",
                "Latin America and Caribbean (WB)",
                "Middle East and North Africa (WB)",
            ],
        },
    },
]
