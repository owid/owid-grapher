import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveManualBreadcrumbsFromNonSDGArticles1736443943021
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        /* As of 09-01-2025, the articles affected by this migration are:
        - https://ourworldindata.org/renewable-energy
        - https://ourworldindata.org/palm-oil
        - https://ourworldindata.org/water-sanitation-2020-update
        - https://ourworldindata.org/fossil-fuels
        - https://ourworldindata.org/inequality-co2
        - https://ourworldindata.org/energy-gdp-decoupling
        - https://ourworldindata.org/adopting-slower-growing-breeds-of-chicken-would-reduce-animal-suffering-significantly
        - https://ourworldindata.org/number-without-electricity
        - https://ourworldindata.org/hygiene
        - https://ourworldindata.org/per-capita-energy
        - https://ourworldindata.org/energy-definitions
        - https://ourworldindata.org/land-use-per-energy-source
        - https://ourworldindata.org/do-better-cages-or-cage-free-environments-really-improve-the-lives-of-hens
        - https://ourworldindata.org/deforestation
        - https://ourworldindata.org/energy-offshoring
        - https://ourworldindata.org/electricity-mix
        - https://ourworldindata.org/clean-water
        - https://ourworldindata.org/global-energy-200-years
        - https://ourworldindata.org/what-are-drivers-deforestation
        - https://ourworldindata.org/energy-substitution-method
        - https://ourworldindata.org/energy-missing-data
        - https://ourworldindata.org/nuclear-energy
        - https://ourworldindata.org/how-many-animals-get-slaughtered-every-day
        - https://ourworldindata.org/energy-ladder
        - https://ourworldindata.org/energy-access
        - https://ourworldindata.org/sanitation
        - https://ourworldindata.org/how-many-animals-are-factory-farmed
        - https://ourworldindata.org/decarbonizing-energy-progress
        */
        await queryRunner.query(
            `-- sql
            UPDATE posts_gdocs SET breadcrumbs = NULL
            WHERE type = 'article'
            AND breadcrumbs IS NOT NULL
            AND slug NOT LIKE "%sdgs%"`
        )
    }

    public async down(): Promise<void> {
        // no-op
    }
}
