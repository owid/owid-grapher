// This is used by owid-wordpress

import { syncPostToGrapher } from "db/model/Post"
import parseArgs from "minimist"
import { BAKE_ON_CHANGE } from "serverSettings"
import { enqueueChange } from "deploy/queue"
import { exit } from "db/cleanup"
const argv = parseArgs(process.argv.slice(2))

async function main(
    email: string,
    name: string,
    postId: number,
    postSlug: string
) {
    console.log(email, name, postId)
    const slug = await syncPostToGrapher(postId)

    if (BAKE_ON_CHANGE) {
        await enqueueChange({
            timeISOString: new Date().toISOString(),
            authorName: name,
            authorEmail: email,
            message: slug ? `Updating ${slug}` : `Deleting ${postSlug}`,
        })
    }

    exit()
}

main(argv._[0], argv._[1], parseInt(argv._[2]), argv._[3])
