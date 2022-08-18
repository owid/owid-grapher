// todo: remove this file

import { bake } from "./DeployUtils.js"
bake().then((_) => {
    // TODO: without this the script hangs here since using the workerpool library in baking
    // I don't understand why this happens. Probably using top level await would also resolve
    // this but I couldn't get Typescript to play along with that
    process.exit(0)
})
