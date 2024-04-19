#! /usr/bin/env node
import { bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers } from "./GrapherBaker.js"
import * as db from "../db/db.js"

/**
 * This bakes all the Graphers to a folder on your computer, running the same baking code as the SiteBaker.
 *
 * Usage: ./runBakeGraphers.ts ~/folder_to_bake_to
 */

const main = async (folder: string) => {
    // TODO: this transaction is only RW because somewhere inside it we fetch images
    return db.knexReadWriteTransaction(
        (trx) =>
            bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers(
                folder,
                trx
            ),
        db.TransactionCloseMode.Close
    )
}

const dir = process.argv.slice(2).join(" ")
void main(dir)
