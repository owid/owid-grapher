/* eslint-disable @typescript-eslint/no-empty-function */
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
        _query: string,
        _parameters?: any[],
        _queryRunner?: QueryRunner
    ): void {}
    logQueryError(
        _error: string,
        _query: string,
        _parameters?: any[],
        _queryRunner?: QueryRunner
    ): void {}
    logQuerySlow(
        _time: number,
        _query: string,
        _parameters?: any[],
        _queryRunner?: QueryRunner
    ): void {}
    logSchemaBuild(_message: string, _queryRunner?: QueryRunner): void {}
    logMigration(_message: string, _queryRunner?: QueryRunner): void {}
    log(
        _level: "log" | "info" | "warn",
        _message: any,
        _queryRunner?: QueryRunner
    ): void {}
}

export class AddTSVToExplorers1742217630523 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Temporarily override the logger to reduce verbosity.
        const originalLogger = queryRunner.connection.logger
        queryRunner.connection.logger = new SilentLogger()
        try {
            await queryRunner.query(
                `ALTER TABLE explorers ADD COLUMN tsv LONGTEXT NOT NULL`
            )
            await queryRunner.query(
                `ALTER TABLE explorers ADD COLUMN lastEditedByUserId int DEFAULT NULL`
            )
            await queryRunner.query(
                `ALTER TABLE explorers ADD COLUMN lastEditedAt datetime DEFAULT NULL`
            )
            await queryRunner.query(
                `ALTER TABLE explorers ADD COLUMN commitMessage VARCHAR(255) DEFAULT NULL`
            )

            // replace isPublished by a virtual column
            await queryRunner.query(
                `ALTER TABLE explorers DROP COLUMN isPublished`
            )
            await queryRunner.query(
                `ALTER TABLE explorers
                ADD COLUMN isPublished BOOLEAN AS (tsv LIKE '%isPublished\ttrue%') VIRTUAL
                `
            )

            const owidContentDir = path.join(__dirname, "../../../owid-content")
            if (await fs.pathExists(owidContentDir)) {
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
                            const commits = await git.log({
                                file: filePath,
                                n: 1,
                            })
                            lastCommit = commits.latest
                        } catch (error) {
                            console.log(
                                `Error retrieving git log for ${filename}: ${error}`
                            )
                        }

                        let userId = null
                        if (lastCommit?.author_email) {
                            const userResult = await queryRunner.query(
                                "SELECT id FROM users WHERE email = ? LIMIT 1",
                                [lastCommit.author_email]
                            )
                            if (userResult?.length) {
                                userId = userResult[0].id
                            }
                        }

                        if (userId === null && lastCommit?.author_name) {
                            const userResult = await queryRunner.query(
                                "SELECT id FROM users WHERE fullName = ? LIMIT 1",
                                [lastCommit.author_name]
                            )
                            if (userResult?.length) {
                                userId = userResult[0].id
                            }
                        }

                        let lastEditedAt = null
                        if (lastCommit?.date) {
                            lastEditedAt = new Date(lastCommit.date)
                        }

                        // Update the explorer record with both TSV and lastCommit JSON.
                        const updateResult: any = await queryRunner.query(
                            `UPDATE explorers SET tsv = ?, lastEditedByUserId = ?, lastEditedAt = ?, commitMessage = ? WHERE slug = ?`,
                            [
                                content,
                                userId,
                                lastEditedAt,
                                lastCommit?.message,
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
            } else {
                console.log(
                    "Directory owid-content does not exist, skipping explorer processing."
                )
            }
        } finally {
            // Restore the original logger.
            queryRunner.connection.logger = originalLogger
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE explorers DROP COLUMN isPublished`)

        // isPublished will be filled by mirror_explorers.py from automation
        await queryRunner.query(
            `ALTER TABLE explorers ADD COLUMN isPublished BOOLEAN`
        )

        // Drop the columns added in the up migration.
        await queryRunner.query(`ALTER TABLE explorers DROP COLUMN tsv`)
        await queryRunner.query(
            `ALTER TABLE explorers DROP COLUMN lastEditedByUserId`
        )
        await queryRunner.query(
            `ALTER TABLE explorers DROP COLUMN lastEditedAt`
        )
        await queryRunner.query(
            `ALTER TABLE explorers DROP COLUMN commitMessage`
        )
    }
}
