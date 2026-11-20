import { MigrationInterface, QueryRunner } from "typeorm"

const WORDPRESS_COUNTRY_PROFILE_SLUGS = [
    "coronavirus-country-profile",
    "co2-country-profile",
    "energy-country-profile",
]

async function setStatus(
    queryRunner: QueryRunner,
    from: string,
    to: string
): Promise<void> {
    await queryRunner.query(
        `-- sql
        UPDATE posts
        SET status        = ?,
            wpApiSnapshot = JSON_SET(wpApiSnapshot, "$.status", ?)
        WHERE status = ?
          AND type = "page"
          AND slug IN (?)`,
        [to, to, from, WORDPRESS_COUNTRY_PROFILE_SLUGS]
    )
}

export class UnpublishWordpressCountryProfiles1794322898134 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await setStatus(queryRunner, "publish", "private")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await setStatus(queryRunner, "private", "publish")
    }
}
