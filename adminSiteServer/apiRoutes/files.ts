import { DbPlainFile, FilesTableName } from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import e from "express"

export async function getFiles(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<{ files: DbPlainFile[] }> {
    const files = await trx(FilesTableName).select("*")
    return { files }
}
