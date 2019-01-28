import { SiteBaker } from 'site/server/SiteBaker'
import { syncPostToGrapher } from 'db/model/Post'
import * as parseArgs from 'minimist'
import * as wpdb from 'db/wpdb'
import * as db from 'db/db'
import { BAKE_ON_CHANGE } from 'serverSettings'
const argv = parseArgs(process.argv.slice(2))

async function main(email: string, name: string, postId: number) {
    try {
        console.log(email, name, postId)
        const slug = await syncPostToGrapher(postId)

        if (BAKE_ON_CHANGE) {
            const baker = new SiteBaker({})
            await baker.bakeAll()
            await baker.deploy(`Updating ${slug}`, email, name)
            baker.end()
        }
    } catch (err) {
        console.error(err)
    } finally {
        await wpdb.end()
        await db.end()
    }
}

main(argv._[0], argv._[1], parseInt(argv._[2]))