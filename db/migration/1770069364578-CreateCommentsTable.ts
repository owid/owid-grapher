import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateCommentsTable1770069364578 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE comments (
                id INT AUTO_INCREMENT PRIMARY KEY,

                -- Target identification
                targetType ENUM('chart', 'variable', 'multidim') NOT NULL,
                targetId VARCHAR(255) NOT NULL,
                viewState JSON DEFAULT NULL,
                fieldPath VARCHAR(255) DEFAULT NULL,

                -- Comment content
                content TEXT NOT NULL,
                threadId INT DEFAULT NULL,

                -- Metadata
                userId INT NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                resolvedAt TIMESTAMP NULL DEFAULT NULL,
                resolvedBy INT DEFAULT NULL,

                -- Indexes
                INDEX idx_comments_target (targetType, targetId),
                INDEX idx_comments_field (targetType, targetId, fieldPath),
                INDEX idx_comments_user (userId),
                INDEX idx_comments_unresolved (resolvedAt),
                INDEX idx_comments_thread (threadId),

                -- Foreign keys
                CONSTRAINT fk_comments_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
                CONSTRAINT fk_comments_resolved_by FOREIGN KEY (resolvedBy) REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT,
                CONSTRAINT fk_comments_thread FOREIGN KEY (threadId) REFERENCES comments(id) ON DELETE CASCADE ON UPDATE RESTRICT
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE comments`)
    }
}
