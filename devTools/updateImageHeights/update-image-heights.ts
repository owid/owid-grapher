import { imageStore } from "../../db/model/Image.js"
import * as db from "../../db/db.js"
import * as lodash from "lodash"
import { exit } from "../../db/cleanup.js"

async function updateImageHeights() {
    const transaction = await db.knexInstance().transaction()
    const filenames = await db
        .knexRaw<{ filename: string }>(
            transaction,
            `SELECT DISTINCT filename
            FROM posts_gdocs_x_images pgxi
            LEFT JOIN images i ON pgxi.imageId = i.id`
        )
        .then((rows) => rows.map((row) => row.filename))

    console.log("Fetching image metadata...")
    const images = await imageStore.fetchImageMetadata([])
    console.log("Fetching image metadata...done")

    if (!images) {
        throw new Error("No images found")
    }

    let imagesWithoutOriginalHeight = []
    try {
        let index = 0
        for (const batch of lodash.chunk(filenames, 20)) {
            const promises = []
            for (const filename of batch) {
                const image = images[filename]
                if (image && image.originalHeight) {
                    promises.push(
                        db.knexRaw(
                            transaction,
                            `
                            UPDATE images
                            SET originalHeight = ?
                            WHERE filename = ?
                        `,
                            [image.originalHeight, filename]
                        )
                    )
                } else {
                    console.error(`No original height found for ${filename}`)
                    imagesWithoutOriginalHeight.push(filename)
                }
            }
            console.log(`Updating image heights for batch ${index}...`)
            await Promise.all(promises)
            console.log(`Updating image heights for batch ${index}...done`)
            index++
        }
        await transaction.commit()
        console.log("All image heights updated successfully!")
        // Most likely due to the original file being deleted but the DB not being updated, each of these will need to be manually checked
        console.log(
            "Images without original height:",
            imagesWithoutOriginalHeight
        )
        await exit()
    } catch (error) {
        console.error(error)
        await transaction.rollback()
        await exit()
    }
}

updateImageHeights()
