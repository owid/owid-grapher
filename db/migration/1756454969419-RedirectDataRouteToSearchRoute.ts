import { MigrationInterface, QueryRunner } from "typeorm"

export class RedirectDataRouteToSearchRoute1756454969419
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Validation 1: Check if /data redirect already exists
        const existingDataRedirect = await queryRunner.query(
            `SELECT 1 FROM redirects WHERE source = ? LIMIT 1`,
            ["/data"]
        )
        if (existingDataRedirect.length > 0) {
            throw new Error("Redirect with source /data already exists")
        }

        // Validation 2: Check for potential redirect chains before adding /data
        // -> /search Look for any redirects that would create chains:
        // - Redirects TO /data (would become X -> /data -> /search)
        // - Redirects FROM /search (would become /data -> /search -> Y).
        //
        //  We specifically expect to find /charts -> /data, which we'll resolve
        //  by updating it to /charts -> /search
        const chainedRedirects = await queryRunner.query(
            `SELECT source, target FROM redirects WHERE source = ? OR target = ?`,
            ["/search", "/data"]
        )

        if (chainedRedirects.length === 0) {
            throw new Error(
                "Expected to find /charts -> /data redirect, but none found. Migration may be unnecessary."
            )
        }

        if (chainedRedirects.length > 1) {
            throw new Error(
                `Found multiple redirects that would create chains. Please resolve them manually before running this migration.`
            )
        }

        const redirect = chainedRedirects[0]
        if (redirect.source !== "/charts" || redirect.target !== "/data") {
            throw new Error(
                `Expected to find /charts -> /data, but found ${redirect.source} -> ${redirect.target}. ` +
                    "This migration is designed to fix the specific /charts -> /data -> /search chain."
            )
        }

        console.log(
            "✓ Found expected redirect chain: /charts -> /data -> /search"
        )
        console.log(
            "✓ Will resolve by updating /charts -> /search and adding /data -> /search"
        )

        // Execute actual migration
        // Resolve chain: Update /charts -> /data to /charts -> /search
        await queryRunner.query(
            `UPDATE redirects SET target = '/search' WHERE source = '/charts'`
        )

        // Add new redirect: /data -> /search
        await queryRunner.query(
            `INSERT INTO redirects (source, target) VALUES ('/data', '/search')`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Clean rollback
        await queryRunner.query(`DELETE FROM redirects WHERE source = '/data'`)
        await queryRunner.query(
            `UPDATE redirects SET target = '/data' WHERE source = '/charts'`
        )
    }
}
