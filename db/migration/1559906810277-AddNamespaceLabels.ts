import { MigrationInterface, QueryRunner } from "typeorm"

export class AddNamespaceLabels1559906810277 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "CREATE TABLE `namespaces` (`id` int NOT NULL AUTO_INCREMENT, `name` varchar(255) NOT NULL, `description` varchar(255), PRIMARY KEY (`id`), UNIQUE KEY `namespaces_name_uq` (`name`)) ENGINE=InnoDB"
        )
        await queryRunner.query(`
            INSERT INTO namespaces (name)
            SELECT DISTINCT namespace AS name
            FROM datasets
        `)
        const namespaceLabels = [
            {
                name: "owid",
                description:
                    "Our World in Data [data uploaded by the OWID-team]",
            },
            {
                name: "wdi",
                description: "World Development Indicators [via World Bank]",
            },
            { name: "penn_world", description: "Penn World Tables" },
            { name: "clioinfra", description: "ClioInfra" },
            { name: "qog", description: "Quality of Government (QOG)" },
            {
                name: "un_sdg",
                description: "UN - Sustainable Development Goals",
            },
            { name: "oecd_stat", description: "OECD Statistics" },
            {
                name: "gbd_cause",
                description: "Global Burden of Disease - Deaths & DALYs",
            },
            {
                name: "gbd_prevalence",
                description:
                    "Global Burden of Disease - Prevalence & Incidence",
            },
            {
                name: "gbd_risk",
                description: "Global Burden of Disease - Risk Factors",
            },
            {
                name: "gbd_mental_health",
                description: "Global Burden of Disease - Mental Health",
            },
            { name: "who_gho", description: "WHO - Global Health Observatory" },
            { name: "unaids", description: "UN HIV/AIDS" },
            { name: "who_cancer_mort", description: "WHO - Cancer Mortality" },
            { name: "who_wash", description: "WHO - Water & Sanitation" },
            {
                name: "edstats",
                description: "EdStats [Education Stats via World Bank]",
            },
            {
                name: "genderstats",
                description: "Gender Stats [via World Bank]",
            },
            { name: "findex", description: "Financial Index [via World Bank]" },
            { name: "povstats", description: "Poverty Stats [via World Bank]" },
            {
                name: "ilostat",
                description: "International Labour Organization (ILO)",
            },
            {
                name: "aspire",
                description: "Social Protection [via World Bank]",
            },
            {
                name: "bbsc",
                description: "Statistical Capacity [via World Bank]",
            },
            {
                name: "faostat",
                description: "UN - Food and Agriculture Organziation (FAO)",
            },
            {
                name: "hnqstats",
                description: "Nutrition & Population Stats [via World Bank]",
            },
            {
                name: "hnpqstats",
                description:
                    "Nutrition & Population Stats by Quintile [via World Bank]",
            },
            { name: "bpstatreview", description: "BP Energy Review" },
            { name: "un_ep", description: "UN Environment Programme" },
            {
                name: "se4all",
                description: "Sustainable Energy [via World Bank]",
            },
            {
                name: "climatech",
                description: "Climate Change [via World Bank]",
            },
            {
                name: "unwpp_female_population",
                description: "UN Population - Female Population",
            },
            {
                name: "unwpp_percentage_of_total_population",
                description: "UN Population - % total population",
            },
            {
                name: "unwpp_total_population",
                description: "UN Population - Total Population",
            },
            {
                name: "unwpp_interpolated_demographic_indicators",
                description: "UN Population - Interpolated Demographics",
            },
            {
                name: "unwpp_dependency_ratios",
                description: "UN Population - Dependency Ratios",
            },
            {
                name: "unwpp_interpolated_total_population",
                description: "UN Population - Interpolated Population",
            },
            {
                name: "unwpp_male_population",
                description: "UN Population - Male Population",
            },
        ]
        for (const row of namespaceLabels) {
            await queryRunner.query(
                `
                INSERT INTO namespaces (name, description)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE description = VALUES(description)
            `,
                [row.name, row.description]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE namespaces")
    }
}
