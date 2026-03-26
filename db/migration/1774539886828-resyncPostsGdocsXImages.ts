import { MigrationInterface, QueryRunner } from "typeorm"

export class ResyncPostsGdocsXImages1774539886828 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Some rows in posts_gdocs_x_images point to old image IDs whose
        // replacedBy column is non-null. We need to follow the replacement
        // chain to find the current (leaf) image and update the reference.
        //
        // The recursive CTE walks from every replaced image to the end of
        // its chain (where replacedBy IS NULL), then we join back to update
        // any stale rows in the join table.
        await queryRunner.query(`-- sql
            UPDATE posts_gdocs_x_images pxi
            JOIN (
                WITH RECURSIVE current_image AS (
                    -- Seed: every image that has been replaced
                    SELECT id AS originalId, replacedBy AS nextId
                    FROM images
                    WHERE replacedBy IS NOT NULL

                    UNION ALL

                    -- Walk the chain until we reach the current version
                    SELECT ci.originalId, i.replacedBy AS nextId
                    FROM current_image ci
                    JOIN images i ON i.id = ci.nextId
                    WHERE i.replacedBy IS NOT NULL
                )
                -- The final step: map each original to the leaf (current) image
                SELECT ci.originalId, ci.nextId AS currentId
                FROM current_image ci
                JOIN images i ON i.id = ci.nextId
                WHERE i.replacedBy IS NULL
            ) AS mapping ON pxi.imageId = mapping.originalId
            SET pxi.imageId = mapping.currentId
        `)
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // N/A
    }
}
