import * as db from './db'


export async function prepareConsole(): Promise<any> {
    await db.connect()

    return { db: db }
}