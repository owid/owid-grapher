import { MigrationInterface, QueryRunner } from "typeorm"

export class AddJobsTableForExplorerViewsRefresh1756150983619
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create jobs table for async job queue
        await queryRunner.query(`
            CREATE TABLE jobs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                type VARCHAR(64) NOT NULL,
                slug VARCHAR(255) NOT NULL,
                state ENUM('queued', 'running', 'done', 'failed') NOT NULL DEFAULT 'queued',
                attempts INT NOT NULL DEFAULT 0,
                priority INT NOT NULL DEFAULT 0, -- unused
                explorerUpdatedAt DATETIME NOT NULL,
                lastError TEXT NULL,
                lockedAt DATETIME NULL, -- unused
                lockedBy VARCHAR(255) NULL, -- unused
                createdAt DATETIME NOT NULL DEFAULT NOW(),
                updatedAt DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                INDEX idx_jobs_type_state_priority_id (type, state, priority, id),
                UNIQUE INDEX idx_jobs_type_slug (type, slug)
            )
        `)

        // Add refresh status columns to explorers table
        await queryRunner.query(`
            ALTER TABLE explorers 
            ADD COLUMN viewsRefreshStatus ENUM('clean', 'queued', 'refreshing', 'failed') NOT NULL DEFAULT 'clean',
            ADD COLUMN lastViewsRefreshAt DATETIME NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove columns from explorers table
        await queryRunner.query(`
            ALTER TABLE explorers 
            DROP COLUMN IF EXISTS viewsRefreshStatus,
            DROP COLUMN IF EXISTS lastViewsRefreshAt
        `)

        // Drop jobs table
        await queryRunner.query(`
            DROP TABLE IF EXISTS jobs
        `)
    }
}
