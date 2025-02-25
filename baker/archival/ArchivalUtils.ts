import { AssetMap, dayjs, lazy, omit } from "@ourworldindata/utils"
import {
    GrapherChecksums,
    GrapherChecksumsObjectWithHash,
} from "./ArchivalChecksumUtils.js"
import { simpleGit } from "simple-git"

export interface ArchivalTimestamp {
    date: Date
    formattedDate: string
}

export interface ArchivalManifest {
    assets: {
        static: AssetMap
        runtime: AssetMap
    }
    archivalDate: string
    chartId: number
    chartConfigId: string
    chartSlug: string
    checksums: GrapherChecksums
    checksumsHashed: string
    commitShas: {
        "owid-grapher"?: string
    }
}

const DATE_TIME_FORMAT = "YYYYMMDD-HHmmss"

export const getDateForArchival = (): ArchivalTimestamp => {
    const date = dayjs().utc()
    const formattedDate = date.format(DATE_TIME_FORMAT)

    return { date: date.toDate(), formattedDate }
}

const getOwidGrapherCommitSha = lazy(async () => {
    if (process.env.BUILDKITE_COMMIT) return process.env.BUILDKITE_COMMIT
    try {
        return await simpleGit().revparse(["HEAD"])
    } catch {
        return undefined
    }
})

export const assembleManifest = async (manifestInfo: {
    staticAssetMap: AssetMap
    runtimeAssetMap: AssetMap
    checksumsObj: GrapherChecksumsObjectWithHash
    archivalDate: string
    chartConfigId: string
}): Promise<ArchivalManifest> => {
    const commitShas = { "owid-grapher": await getOwidGrapherCommitSha() }

    const manifest = {
        ...omit(manifestInfo, [
            "staticAssetMap",
            "runtimeAssetMap",
            "checksumsObj",
        ]),
        ...manifestInfo.checksumsObj,
        assets: {
            static: manifestInfo.staticAssetMap,
            runtime: manifestInfo.runtimeAssetMap,
        },
        commitShas,
    }

    return manifest
}
