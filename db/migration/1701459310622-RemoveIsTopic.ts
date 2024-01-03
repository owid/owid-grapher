import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveIsTopic1701459310622 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE tags
            DROP COLUMN isTopic;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SELECT id FROM tags WHERE isTopic = TRUE
        // live_grapher 2023-12-01
        const IDS_OF_TOPIC_TAGS = [
            1, 3, 4, 5, 7, 8, 11, 13, 14, 15, 16, 17, 18, 19, 22, 24, 25, 28,
            30, 35, 36, 37, 38, 39, 40, 43, 44, 46, 58, 62, 67, 71, 72, 80, 81,
            82, 88, 89, 90, 91, 92, 93, 99, 102, 105, 106, 107, 110, 111, 114,
            134, 135, 147, 159, 160, 161, 163, 175, 180, 186, 206, 217, 231,
            233, 242, 244, 246, 255, 279, 282, 285, 289, 290, 291, 293, 294,
            295, 300, 302, 305, 307, 313, 314, 324, 325, 1557, 1560, 1563, 1568,
            1572, 1573, 1575, 1576, 1578, 1582, 1584, 1589, 1602, 1603, 1639,
            1791, 1792, 1793, 1795, 1796, 1797, 1798, 1800, 1801, 1804, 1806,
            1807, 1809, 1810, 1811, 1812, 1815, 1816, 1817, 1818, 1819, 1821,
            1822, 1823, 1824, 1825, 1826, 1827,
        ]
        await queryRunner.query(`
            ALTER TABLE tags
            ADD COLUMN isTopic TINYINT(1) NOT NULL DEFAULT 0;
        `)

        for (const id of IDS_OF_TOPIC_TAGS) {
            await queryRunner.query(`
                UPDATE tags
                SET isTopic = 1
                WHERE id = ${id};
            `)
        }
    }
}
