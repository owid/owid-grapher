import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameGdocByline1684946878935 implements MigrationInterface {
    /*
     before: {  "byline" : "Max Roser, Hannah Ritchie" }
     after:  {  "authors" : ["Max Roser", "Hannah Ritchie"] }
    */
    public async up(queryRunner: QueryRunner): Promise<void> {
        const results: { id: string; content: string }[] =
            await queryRunner.query("SELECT id, content FROM posts_gdocs")

        const gdocs = results.map((result) => ({
            ...result,
            content: JSON.parse(result.content),
        }))

        for (const gdoc of gdocs) {
            const byline: string = gdoc.content.byline
            delete gdoc.content.byline
            const authors = gdoc.content.authors
            if (byline) {
                const authors = byline.split(",").map((author) => author.trim())

                await queryRunner.query(
                    "UPDATE posts_gdocs SET content = ? WHERE id = ?",
                    [
                        JSON.stringify({
                            ...gdoc.content,
                            authors,
                        }),
                        gdoc.id,
                    ]
                )
            } else if (!authors) {
                await queryRunner.query(
                    "UPDATE posts_gdocs SET content = ? WHERE id = ?",
                    [
                        JSON.stringify({
                            ...gdoc.content,
                            authors: ["Our World In Data"],
                        }),
                        gdoc.id,
                    ]
                )
            } else if (typeof authors === "string") {
                await queryRunner.query(
                    "UPDATE posts_gdocs SET content = ? WHERE id = ?",
                    [
                        JSON.stringify({
                            ...gdoc.content,
                            authors: authors
                                .split(",")
                                .map((author) => author.trim()),
                        }),
                        gdoc.id,
                    ]
                )
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const results: { id: string; content: string }[] =
            await queryRunner.query("SELECT id, content FROM posts_gdocs")

        const gdocs = results.map((result) => ({
            ...result,
            content: JSON.parse(result.content),
        }))

        for (const gdoc of gdocs) {
            const authors: string[] = gdoc.content.authors
            if (authors) {
                const byline = authors.join(", ")

                delete gdoc.content.authors

                await queryRunner.query(
                    "UPDATE posts_gdocs SET content = ? WHERE id = ?",
                    [
                        JSON.stringify({
                            ...gdoc.content,
                            byline,
                        }),
                        gdoc.id,
                    ]
                )
            } else if (!gdoc.content.byline) {
                await queryRunner.query(
                    "UPDATE posts_gdocs SET content = ? WHERE id = ?",
                    [
                        JSON.stringify({
                            ...gdoc.content,
                            byline: "Our World In Data",
                        }),
                        gdoc.id,
                    ]
                )
            }
        }
    }
}
