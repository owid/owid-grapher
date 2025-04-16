import { dayjs, lazy, omit } from "@ourworldindata/utils"
import { ARCHIVE_DATE_TIME_FORMAT, AssetMap } from "@ourworldindata/types"
import {
    GrapherChecksums,
    GrapherChecksumsObjectWithHash,
} from "./archivalChecksum.js"
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

export const getDateForArchival = (dateInput?: Date): ArchivalTimestamp => {
    const date = dayjs(dateInput)
        .utc()
        // it's important here that we explicitly set the milliseconds to 0 -
        // otherwise we run the risk of MySQL rounding up to the next second,
        // which would break the archival URL
        .millisecond(0)
    const formattedDate = date.format(ARCHIVE_DATE_TIME_FORMAT)

    return { date: date.toDate(), formattedDate }
}

const getOwidGrapherCommitSha = lazy(async () => {
    try {
        return await simpleGit().revparse(["HEAD"])
    } catch {
        return undefined
    }
})

export const assembleGrapherArchivalUrl = (
    archivalDate: string | Date,
    chartSlug: string
) => {
    let formattedDate: string
    if (typeof archivalDate === "string") {
        formattedDate = archivalDate
    } else {
        formattedDate = getDateForArchival(archivalDate).formattedDate
    }

    return `/${formattedDate}/grapher/${chartSlug}.html`
}

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
