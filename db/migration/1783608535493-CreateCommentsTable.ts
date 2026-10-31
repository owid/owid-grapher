import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateCommentsTable1783608535493 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE comments (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,

                -- What the comment is attached to. targetId references charts.id,
                -- variables.id or multi_dim_data_pages.id depending on targetType
                -- (validated in the API, no FK possible on a polymorphic column).
                targetType ENUM('chart', 'variable', 'multiDim') NOT NULL,
                targetId INT NOT NULL,

                -- Optional finer-grained anchor within the target, e.g. a metadata
                -- field on a data page ("descriptionShort") and, for multi-dims,
                -- the dimension choices of the view being commented on.
                anchor VARCHAR(255) DEFAULT NULL,
                viewState JSON DEFAULT NULL,

                -- Replies set parentId to the root comment of their thread.
                -- Resolution state lives on the root comment only.
                parentId INT DEFAULT NULL,
                content TEXT NOT NULL,

                userId INT NOT NULL,
                resolvedAt TIMESTAMP NULL DEFAULT NULL,
                resolvedByUserId INT DEFAULT NULL,
                createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                INDEX idx_comments_target (targetType, targetId),

                CONSTRAINT fk_comments_parent FOREIGN KEY (parentId)
                    REFERENCES comments (id) ON DELETE CASCADE,
                CONSTRAINT fk_comments_user FOREIGN KEY (userId)
                    REFERENCES users (id),
                CONSTRAINT fk_comments_resolved_by_user FOREIGN KEY (resolvedByUserId)
                    REFERENCES users (id) ON DELETE SET NULL
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE comments
        `)
    }
}
