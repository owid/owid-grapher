import { MigrationInterface, QueryRunner, Logger } from "typeorm"
import fs from "fs-extra"
import {
    EXPLORER_FILE_SUFFIX,
    EXPLORERS_GIT_CMS_FOLDER,
} from "@ourworldindata/explorer"
import * as path from "path"
import { simpleGit } from "simple-git"

// Explorer configs are huge, use custom logger to avoid filling up the terminal.
class SilentLogger implements Logger {
    logQuery(
        query: string,
        parameters?: any[],
        queryRunner?: QueryRunner
    ): void {}
    logQueryError(
        error: string,
        query: string,
        parameters?: any[],
        queryRunner?: QueryRunner
    ): void {}
    logQuerySlow(
        time: number,
        query: string,
        parameters?: any[],
        queryRunner?: QueryRunner
    ): void {}
    logSchemaBuild(message: string, queryRunner?: QueryRunner): void {}
    logMigration(message: string, queryRunner?: QueryRunner): void {}
    log(
        level: "log" | "info" | "warn",
        message: any,
        queryRunner?: QueryRunner
    ): void {}
}

export class AddTSVToExplorers1742217630523 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Temporarily override the logger to reduce verbosity.
        const originalLogger = queryRunner.connection.logger
        queryRunner.connection.logger = new SilentLogger()
        try {
            // Add the "tsv" column to the explorers table (MySQL syntax)
            await queryRunner.query(
                `ALTER TABLE explorers ADD COLUMN tsv LONGTEXT`
            )

            // Add the "lastCommit" column (using JSON type).
            await queryRunner.query(
                `ALTER TABLE explorers ADD COLUMN lastCommit JSON`
            )

            const owidContentDir = path.join(__dirname, "../../../owid-content")
            const explorersDir = path.join(
                owidContentDir,
                EXPLORERS_GIT_CMS_FOLDER
            )
            const explorerFiles = await fs.readdir(explorersDir)

            // Initialize simpleGit using the repository root (adjust baseDir if necessary)
            const git = simpleGit({
                baseDir: owidContentDir,
                binary: "git",
                maxConcurrentProcesses: 16,
            })

            for (const filename of explorerFiles) {
                if (filename.endsWith(EXPLORER_FILE_SUFFIX)) {
                    const slug = filename.replace(EXPLORER_FILE_SUFFIX, "")
                    const filePath = path.join(explorersDir, filename)
                    const content = await fs.readFile(filePath, "utf8")

                    // Get the last commit for this file.
                    let lastCommit: any = null
                    try {
                        const commits = await git.log({ file: filePath, n: 1 })
                        lastCommit = commits.latest
                    } catch (error) {
                        console.log(
                            `Error retrieving git log for ${filename}: ${error}`
                        )
                    }

                    // Update the explorer record with both TSV and lastCommit JSON.
                    const updateResult: any = await queryRunner.query(
                        `UPDATE explorers SET tsv = ?, lastCommit = ? WHERE slug = ?`,
                        [
                            content,
                            lastCommit ? JSON.stringify(lastCommit) : null,
                            slug,
                        ]
                    )

                    if (!updateResult || updateResult.affectedRows === 0) {
                        console.log(
                            `Explorer with slug "${slug}" not found. Skipping.`
                        )
                    }
                }
            }
        } finally {
            // Restore the original logger.
            queryRunner.connection.logger = originalLogger
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the "lastCommit" and "tsv" columns.
        await queryRunner.query(`ALTER TABLE explorers DROP COLUMN lastCommit`)
        await queryRunner.query(`ALTER TABLE explorers DROP COLUMN tsv`)
    }
}
