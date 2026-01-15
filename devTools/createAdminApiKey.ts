import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as db from "../db/db.js"
import { AdminApiKeysTableName, type DbPlainUser } from "@ourworldindata/types"
import { createApiKey, hashApiKey } from "../serverUtils/apiKey.js"

interface CreateAdminApiKeyArgs {
    userId: number
}

async function createApiKeyPair(): Promise<{
    apiKey: string
    keyHash: string
}> {
    const apiKey = createApiKey()
    const keyHash = hashApiKey(apiKey)
    return { apiKey, keyHash }
}

async function main(args: CreateAdminApiKeyArgs) {
    try {
        const result = await db.knexReadWriteTransaction(async (trx) => {
            const user = await trx("users")
                .where({ id: args.userId })
                .first<DbPlainUser>()
            if (!user) {
                throw new Error(`User with id ${args.userId} not found.`)
            }

            const { apiKey, keyHash } = await createApiKeyPair()

            await trx(AdminApiKeysTableName).insert({
                userId: args.userId,
                keyHash,
            })

            return { apiKey, user }
        }, db.TransactionCloseMode.Close)

        console.log(
            `Created admin API key for ${result.user.fullName} (${result.user.email}).`
        )
        console.log("API key (store securely; it won't be shown again):")
        console.log(result.apiKey)
    } catch (error) {
        console.error("Encountered an error: ", error)
        // Ensures process terminates after errors.
        process.exit(-1)
    }
}

void yargs(hideBin(process.argv))
    .command(
        "$0",
        "Create an admin API key for a user",
        (yargsInstance) =>
            yargsInstance
                .option("userId", {
                    type: "number",
                    demandOption: true,
                    describe: "User id to associate with the new API key",
                })
                .check((argv) => {
                    if (
                        typeof argv.userId !== "number" ||
                        !Number.isInteger(argv.userId) ||
                        argv.userId <= 0
                    ) {
                        throw new Error("userId must be a positive integer.")
                    }
                    return true
                }),
        (argv) => void main({ userId: argv.userId })
    )
    .strict()
    .help().argv
