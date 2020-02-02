import * as db from "db/db"
import * as wpdb from "db/wpdb"
import {
    renderBlogByPageNum,
    renderFrontPage,
    renderPageById,
    renderSubscribePage
} from "site/server/siteBaking"

async function main(target: string, isPreview?: boolean) {
    try {
        if (target === "front") {
            console.log(await renderFrontPage())
        } else if (target === "subscribe") {
            console.log(await renderSubscribePage())
        } else if (target === "blog") {
            const pageNum = process.argv[3] ? parseInt(process.argv[3]) : 1
            console.log(await renderBlogByPageNum(pageNum === 0 ? 1 : pageNum))
        } else {
            console.log(await renderPageById(parseInt(target), isPreview))
        }
    } catch (err) {
        console.error(err)
    } finally {
        wpdb.end()
        db.end()
    }
}

if (require.main === module)
    main(process.argv[2], process.argv[3] === "preview")
