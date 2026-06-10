#!/usr/bin/env tsx

import { execSync } from "child_process"
import { DataSource } from "typeorm"
import { dataSource } from "../../db/dataSource.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

function normalizeBranch(branchName: string): string {
    return branchName.replace(/[/._]/g, "-")
}

function getContainerName(branchName: string): string {
    let normalized = normalizeBranch(branchName)

    // Strip staging-site- prefix to add it back later
    normalized = normalized.replace(/^staging-site-/, "")

    // Truncate to 28 characters (Cloudflare's limit)
    const limit = 28
    const containerName = `staging-site-${normalized.slice(0, limit)}`

    // Remove trailing hyphens
    return containerName.replace(/-+$/, "")
}

function getCurrentBranch(): string {
    return execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf-8",
    }).trim()
}

function createStagingDataSource(stagingHost: string): DataSource {
    return new DataSource({
        type: "mysql",
        host: stagingHost,
        port: 3306,
        username: "owid",
        password: "",
        database: "owid",
        charset: "utf8mb4",
        connectorPackage: "mysql2",
    })
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .command(
            "$0 <sql>",
            "Execute SQL query against the database",
            (yargs) => {
                yargs.positional("sql", {
                    describe: "SQL query to execute",
                    type: "string",
                    demandOption: true,
                })
            }
        )
        .option("staging", {
            alias: "s",
            type: "boolean",
            description: "Connect to staging MySQL for the current git branch",
        })
        .example("$0 'SELECT * FROM users LIMIT 10'", "Basic query")
        .example(
            "$0 \"SELECT content->>'$.title' FROM posts_gdocs LIMIT 1\"",
            "JSON path query"
        )
        .example(
            "$0 --staging 'SELECT COUNT(*) FROM analytics_pageviews'",
            "Query staging database for current branch"
        )
        .help()
        .alias("h", "help")
        .parseSync()

    const sql = argv.sql as string
    const useStaging = argv.staging
    const stagingHost = useStaging
        ? getContainerName(getCurrentBranch())
        : undefined

    if (!sql) {
        console.error("Error: SQL query is required")
        process.exit(1)
    }

    const db = stagingHost ? createStagingDataSource(stagingHost) : dataSource

    try {
        await db.initialize()

        if (stagingHost) {
            console.log(`Connected to staging: ${stagingHost}`)
        }
        const queryRunner = db.createQueryRunner()
        await queryRunner.connect()
        try {
            await queryRunner.query("START TRANSACTION READ ONLY")
            const result = await queryRunner.query(sql)
            await queryRunner.query("COMMIT")

            if (Array.isArray(result) && result.length > 0) {
                console.table(result)
            } else {
                console.log("Query executed successfully. No results returned.")
            }
        } finally {
            await queryRunner.release()
        }
    } catch (error) {
        console.error("Error executing query:", error)
        process.exit(1)
    } finally {
        if (db.isInitialized) {
            await db.destroy()
        }
    }
}

main().catch((error) => {
    console.error("Unexpected error:", error)
    process.exit(1)
})
