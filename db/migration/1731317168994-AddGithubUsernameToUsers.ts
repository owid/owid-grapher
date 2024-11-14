import { MigrationInterface, QueryRunner } from "typeorm"

export class AddGithubUsernameToUsers1731317168994
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add 'githubUsername' column using raw SQL
        await queryRunner.query(`
            ALTER TABLE users ADD COLUMN githubUsername VARCHAR(255) NULL;
        `)

        // Update 'githubUsername' for specific users
        const updates = [
            { fullName: "Martin Račák", githubUsername: "rakyi@github" },
            {
                fullName: "Marcel Gerber",
                githubUsername: "marcelgerber@github",
            },
            { fullName: "Lars Yencken", githubUsername: "larsyencken@github" },
            { fullName: "Matthieu Bergel", githubUsername: "mlbrgl@github" },
            {
                fullName: "Simon van Teutem",
                githubUsername: "simonvanteutem@github",
            },
            {
                fullName: "Lucas Rodés-Guirao",
                githubUsername: "lucasrodes@github",
            },
            {
                fullName: "Veronika Samborska",
                githubUsername: "veronikasamborska1994@github",
            },
            { fullName: "Saloni Dattani", githubUsername: "saloni-nd@github" },
            {
                fullName: "Charlie Giattino",
                githubUsername: "CGiattino@github",
            },
            {
                fullName: "Hannah Ritchie",
                githubUsername: "HannahRitchie@github",
            },
            { fullName: "Mojmir Vinkler", githubUsername: "Marigold@github" },
            { fullName: "Ike Saunders", githubUsername: "ikesau@github" },
            {
                fullName: "Sophia Mersmann",
                githubUsername: "sophiamersmann@github",
            },
            { fullName: "Joe Hasell", githubUsername: "JoeHasell@github" },
            { fullName: "Edouard Mathieu", githubUsername: "edomt@github" },
            { fullName: "Daniel Bachler", githubUsername: "danyx23@github" },
            { fullName: "Fiona Spooner", githubUsername: "spoonerf@github" },
            { fullName: "Marwa Boukarim", githubUsername: "mrwbkrm@github" },
            { fullName: "Max Roser", githubUsername: "maxroser@github" },
            {
                fullName: "Pablo Arriagada",
                githubUsername: "paarriagadap@github",
            },
            { fullName: "Tuna Acisu", githubUsername: "antea04@github" },
            {
                fullName: "Esteban Ortiz-Ospina",
                githubUsername: "eoo-owid@github",
            },
            {
                fullName: "Natalie Reynolds-Garcia",
                githubUsername: "natreygar@github",
            },
            { fullName: "Bertha Rohenkohl", githubUsername: "bertharc@github" },
            {
                fullName: "Bobbie Macdonald",
                githubUsername: "bnjmacdonald@github",
            },
            {
                fullName: "Angela Wenham",
                githubUsername: "angelawenham@github",
            },
            { fullName: "Pablo Rosado", githubUsername: "pabloarosado@github" },
            {
                fullName: "Bastian Herre",
                githubUsername: "bastianherre@github",
            },
            { fullName: "Valerie Muigai", githubUsername: "ValRMuigai@github" },
        ]

        for (const { fullName, githubUsername } of updates) {
            await queryRunner.query(
                `
            UPDATE users
            SET githubUsername = ?
            WHERE fullName = ?;
            `,
                [githubUsername, fullName]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove 'githubUsername' column using raw SQL
        await queryRunner.query(`
            ALTER TABLE users DROP COLUMN githubUsername;
        `)
    }
}
