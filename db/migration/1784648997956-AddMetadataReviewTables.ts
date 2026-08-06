import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Tables for the ETL "Metadata Review" tool (wizard app + `etl metadata-review`):
 * field-level suggestions and threaded comments on the user-facing metadata of
 * MDims and indicators (FAUST text, description_short, description_key, MDim
 * dropdown labels).
 *
 * Addressing is environment-agnostic (catalog paths and MDim view ids rather
 * than numeric chart/variable ids), so rows written on a staging server stay
 * meaningful when read against production and vice versa.
 */
export class AddMetadataReviewTables1784648997956 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE metadata_review_suggestions (
                id integer NOT NULL AUTO_INCREMENT,
                -- 'mdim' or 'indicator'
                targetType varchar(32) NOT NULL,
                -- multi_dim_data_pages.catalogPath or variables.catalogPath
                targetPath varchar(767) NOT NULL,
                -- normalized dimensionsToViewId string; only for MDim view-scoped fields
                viewId varchar(512) DEFAULT NULL,
                -- e.g. 'config.subtitle', 'description_short', 'dimensions.<dim>.choices.<choice>.name'
                fieldPath varchar(255) NOT NULL,
                -- 'override' / 'inherited' / 'missing' at suggestion time
                provenance varchar(16) NOT NULL,
                -- indicator catalogPath the value inherits from (when filed on an MDim view)
                inheritedFromPath varchar(767) DEFAULT NULL,
                -- where the reviewer was when filing (context for source-keyed suggestions)
                filedFromPath varchar(767) DEFAULT NULL,
                filedFromViewId varchar(512) DEFAULT NULL,
                -- resolved value snapshot at suggestion time (staleness detection)
                currentValue mediumtext,
                -- NULL = comment-only thread anchored to the field
                suggestedValue mediumtext,
                -- multi_dim_data_pages.configMd5 or variables.metadataChecksum at suggestion time
                pageChecksum varchar(64) DEFAULT NULL,
                -- 'open' / 'implemented' / 'rejected'
                status varchar(32) NOT NULL DEFAULT 'open',
                createdBy integer NOT NULL,
                resolvedBy integer DEFAULT NULL,
                resolvedAt datetime DEFAULT NULL,
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                -- One OPEN thread per field, enforced at the database level:
                -- NULL for resolved rows (NULLs never collide in a unique index).
                openKeyHash char(32) GENERATED ALWAYS AS (
                    IF(status = 'open', MD5(CONCAT_WS('|', targetType, targetPath, IFNULL(viewId, ''), fieldPath)), NULL)
                ) STORED,

                PRIMARY KEY (id),

                CONSTRAINT metadata_review_suggestions_createdBy_fk FOREIGN KEY (createdBy) REFERENCES users (id) ON DELETE RESTRICT,
                CONSTRAINT metadata_review_suggestions_resolvedBy_fk FOREIGN KEY (resolvedBy) REFERENCES users (id) ON DELETE RESTRICT,

                INDEX idx_mrs_target (targetType, targetPath(191)),
                INDEX idx_mrs_field (targetPath(191), viewId(191), fieldPath(64)),
                INDEX idx_mrs_status (status),
                UNIQUE INDEX idx_mrs_open_unique (openKeyHash)
            )
        `)
        await queryRunner.query(`-- sql
            CREATE TABLE metadata_review_comments (
                id integer NOT NULL AUTO_INCREMENT,
                suggestionId integer NOT NULL,
                -- threaded replies (self-referencing)
                parentCommentId integer DEFAULT NULL,
                userId integer NOT NULL,
                -- 'comment' or 'status_change' (auto-comment recording a status flip)
                kind varchar(32) NOT NULL DEFAULT 'comment',
                text mediumtext NOT NULL,
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                PRIMARY KEY (id),

                CONSTRAINT metadata_review_comments_suggestionId_fk FOREIGN KEY (suggestionId) REFERENCES metadata_review_suggestions (id) ON DELETE CASCADE,
                CONSTRAINT metadata_review_comments_parentCommentId_fk FOREIGN KEY (parentCommentId) REFERENCES metadata_review_comments (id) ON DELETE CASCADE,
                CONSTRAINT metadata_review_comments_userId_fk FOREIGN KEY (userId) REFERENCES users (id) ON DELETE RESTRICT,

                INDEX idx_mrc_suggestion (suggestionId)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE metadata_review_comments`)
        await queryRunner.query(`DROP TABLE metadata_review_suggestions`)
    }
}
