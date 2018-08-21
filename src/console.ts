import * as db from './db'

// Return value of prepareConsole is used as global namespace for `yarn c`
export async function prepareConsole(): Promise<any> {
    const connection = await db.connect()

    const exposeToConsole: {[key: string]: any} = {
        db: db
    }

    // Expose all typeorm models
    for (const meta of connection.entityMetadatas) {
        exposeToConsole[meta.targetName] = meta.target
    }

    return exposeToConsole
}