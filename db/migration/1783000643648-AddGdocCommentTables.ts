import { MigrationInterface, QueryRunner } from "typeorm"

export class AddGdocCommentTables1783000643648 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Comment threads on natively-edited gdocs. A thread is anchored to a
        // text range or a block (via ProseMirror positions in the draft doc),
        // or to the document as a whole. Threads whose anchor text/block was
        // deleted become "orphaned" rather than disappearing.
        await queryRunner.query(`-- sql
            CREATE TABLE posts_gdocs_comment_threads (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                gdocId VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                status ENUM('open', 'resolved', 'orphaned') NOT NULL DEFAULT 'open',
                anchorType ENUM('range', 'block', 'document') NOT NULL DEFAULT 'range',
                anchorFrom INT NULL,
                anchorTo INT NULL,
                anchorText VARCHAR(512) NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                createdBy INT NULL,
                resolvedAt DATETIME NULL,
                resolvedBy INT NULL,
                PRIMARY KEY (id),
                KEY idx_posts_gdocs_comment_threads_gdocId (gdocId, status),
                CONSTRAINT posts_gdocs_comment_threads_gdocId_fk FOREIGN KEY (gdocId)
                    REFERENCES posts_gdocs (id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT posts_gdocs_comment_threads_createdBy_fk FOREIGN KEY (createdBy)
                    REFERENCES users (id) ON DELETE SET NULL,
                CONSTRAINT posts_gdocs_comment_threads_resolvedBy_fk FOREIGN KEY (resolvedBy)
                    REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)

        await queryRunner.query(`-- sql
            CREATE TABLE posts_gdocs_comments (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                threadId BIGINT UNSIGNED NOT NULL,
                userId INT NULL,
                text TEXT NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_posts_gdocs_comments_threadId (threadId),
                CONSTRAINT posts_gdocs_comments_threadId_fk FOREIGN KEY (threadId)
                    REFERENCES posts_gdocs_comment_threads (id) ON DELETE CASCADE,
                CONSTRAINT posts_gdocs_comments_userId_fk FOREIGN KEY (userId)
                    REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS posts_gdocs_comments
        `)
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS posts_gdocs_comment_threads
        `)
    }
}
