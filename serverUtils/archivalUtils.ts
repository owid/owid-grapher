import * as _ from "lodash-es"
import {
    lazy,
    convertToArchivalDateStringIfNecessary,
    DateInput,
} from "@ourworldindata/utils"
import {
    AssetMap,
    GrapherChecksums,
    GrapherChecksumsObjectWithHash,
    MultiDimChecksums,
    MultiDimChecksumsObjectWithHash,
    ExplorerChecksums,
    ExplorerChecksumsObjectWithHash,
} from "@ourworldindata/types"
import { simpleGit } from "simple-git"
import { ARCHIVE_BASE_URL } from "../settings/serverSettings.js"

export interface BaseArchivalManifest {
    assets: {
        static: AssetMap
        runtime: AssetMap
    }
    archivalDate: string
    checksumsHashed: string
    commitShas: {
        "owid-grapher"?: string
    }
}

export interface GrapherArchivalManifest extends BaseArchivalManifest {
    chartId: number
    chartConfigId: string
    chartSlug: string
    checksums: GrapherChecksums
}

export interface MultiDimArchivalManifest extends BaseArchivalManifest {
    multiDimId: number
    multiDimSlug: string
    checksums: MultiDimChecksums
}

export interface ExplorerArchivalManifest extends BaseArchivalManifest {
    explorerSlug: string
    checksums: ExplorerChecksums
}

const getOwidGrapherCommitSha = lazy(async () => {
    try {
        return await simpleGit().revparse(["HEAD"])
    } catch {
        return undefined
    }
})

export const assembleGrapherArchivalUrl = (
    archivalDate: DateInput,
    chartSlug: string,
    { relative }: { relative: boolean }
) => {
    const formattedDate = convertToArchivalDateStringIfNecessary(archivalDate)

    const path = `/${formattedDate}/grapher/${chartSlug}.html`
    if (relative) return path
    else {
        if (!ARCHIVE_BASE_URL) {
            throw new Error("ARCHIVE_BASE_URL is not defined")
        }
        return `${ARCHIVE_BASE_URL}${path}`
    }
}

export const assembleGrapherManifest = async (manifestInfo: {
    staticAssetMap: AssetMap
    runtimeAssetMap: AssetMap
    checksumsObj: GrapherChecksumsObjectWithHash
    archivalDate: string
    chartConfigId: string
}): Promise<GrapherArchivalManifest> => {
    const commitShas = { "owid-grapher": await getOwidGrapherCommitSha() }

    const manifest = {
        ..._.omit(manifestInfo, [
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

export const assembleExplorerArchivalUrl = (
    archivalDate: DateInput,
    explorerSlug: string,
    { relative }: { relative: boolean }
) => {
    const formattedDate = convertToArchivalDateStringIfNecessary(archivalDate)

    const path = `/${formattedDate}/explorers/${explorerSlug}.html`
    if (relative) return path
    else {
        if (!ARCHIVE_BASE_URL) {
            throw new Error("ARCHIVE_BASE_URL is not defined")
        }
        return `${ARCHIVE_BASE_URL}${path}`
    }
}

export const assembleExplorerManifest = async (manifestInfo: {
    staticAssetMap: AssetMap
    runtimeAssetMap: AssetMap
    checksumsObj: ExplorerChecksumsObjectWithHash
    archivalDate: string
}): Promise<ExplorerArchivalManifest> => {
    const commitShas = { "owid-grapher": await getOwidGrapherCommitSha() }

    const manifest = {
        ..._.omit(manifestInfo, [
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

export const assembleMultiDimArchivalUrl = (
    archivalDate: DateInput,
    slug: string,
    { relative }: { relative: boolean }
) => {
    const formattedDate = convertToArchivalDateStringIfNecessary(archivalDate)

    const path = `/${formattedDate}/grapher/${slug}.html`
    if (relative) return path
    else {
        if (!ARCHIVE_BASE_URL) {
            throw new Error("ARCHIVE_BASE_URL is not defined")
        }
        return `${ARCHIVE_BASE_URL}${path}`
    }
}

export const assembleMultiDimManifest = async (manifestInfo: {
    staticAssetMap: AssetMap
    runtimeAssetMap: AssetMap
    checksumsObj: MultiDimChecksumsObjectWithHash
    archivalDate: string
}): Promise<MultiDimArchivalManifest> => {
    const commitShas = { "owid-grapher": await getOwidGrapherCommitSha() }

    const manifest = {
        ..._.omit(manifestInfo, [
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
