import { MigrationInterface, QueryRunner } from "typeorm"

export class AddSlackUsernameToUsers1767863328279
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users ADD COLUMN slackUsername VARCHAR(255) NULL;
        `)

        const updates = [
            { fullName: "Angela Wenham", slackUsername: "Angela" },
            { fullName: "Antoinette Finnegan", slackUsername: "Antoinette" },
            { fullName: "Bastian Herre", slackUsername: "Bastian" },
            { fullName: "Bertha Rohenkohl", slackUsername: "Bertha" },
            { fullName: "Bobbie Macdonald", slackUsername: "bobbie" },
            { fullName: "Charlie Giattino", slackUsername: "charlie" },
            { fullName: "Daniel Bachler", slackUsername: "daniel" },
            { fullName: "Edouard Mathieu", slackUsername: "Ed" },
            { fullName: "Esteban Ortiz-Ospina", slackUsername: "Este" },
            { fullName: "Fiona Spooner", slackUsername: "Fiona" },
            { fullName: "Hannah Ritchie", slackUsername: "hannah" },
            { fullName: "Ike Saunders", slackUsername: "ike" },
            { fullName: "Joe Hasell", slackUsername: "joe" },
            { fullName: "Lucas Rodés-Guirao", slackUsername: "lucas" },
            { fullName: "Marcel Gerber", slackUsername: "marcel" },
            { fullName: "Martin Račák", slackUsername: "Martin" },
            { fullName: "Marwa Boukarim", slackUsername: "Marwa" },
            { fullName: "Matthieu Bergel", slackUsername: "matthieu" },
            { fullName: "Max Roser", slackUsername: "max" },
            { fullName: "Mojmir Vinkler", slackUsername: "Mojmir" },
            { fullName: "Natalie Reynolds-Garcia", slackUsername: "Nat" },
            { fullName: "Pablo Arriagada", slackUsername: "Pablo A" },
            { fullName: "Pablo Rosado", slackUsername: "Pablo R" },
            { fullName: "Sophia Mersmann", slackUsername: "sophia" },
            { fullName: "Tuna Acisu", slackUsername: "Tuna" },
            { fullName: "Valerie Muigai", slackUsername: "Valerie" },
            { fullName: "Veronika Samborska", slackUsername: "Veronika" },
        ]

        for (const { fullName, slackUsername } of updates) {
            await queryRunner.query(
                `
                UPDATE users
                SET slackUsername = ?
                WHERE fullName = ?;
                `,
                [slackUsername, fullName]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users DROP COLUMN slackUsername;
        `)
    }
}
