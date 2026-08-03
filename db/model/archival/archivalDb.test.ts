import { expect, it, describe } from "vitest"
import { GrapherChecksums } from "@ourworldindata/types"
import { hashGrapherChecksumsObj } from "./archivalDb.js"

const checksums = (extra?: Partial<GrapherChecksums>): GrapherChecksums => ({
    chartConfigMd5: "iCzWQFmKfPHDPq4hOCPClg==",
    indicators: {
        "1234": { metadataChecksum: "abc", dataChecksum: "def" },
    },
    ...extra,
})

describe("grapher archival checksums", () => {
    it("ignores an absent deprecation notice", () => {
        // The archival baker re-snapshots a chart whenever this hash changes, so introducing the
        // deprecation notice must not perturb the hash of the charts that don't have one. If it
        // did, the first run after deploying would re-archive every published chart at once.
        expect(hashGrapherChecksumsObj(checksums())).toEqual(
            hashGrapherChecksumsObj(
                checksums({ deprecationNoticeMd5: undefined })
            )
        )
    })

    it("changes when a deprecation notice is added", () => {
        expect(hashGrapherChecksumsObj(checksums())).not.toEqual(
            hashGrapherChecksumsObj(
                checksums({ deprecationNoticeMd5: "5rIDNJ1sQpXtQF5UbBUmSA==" })
            )
        )
    })

    it("changes when a deprecation notice is edited", () => {
        expect(
            hashGrapherChecksumsObj(
                checksums({ deprecationNoticeMd5: "5rIDNJ1sQpXtQF5UbBUmSA==" })
            )
        ).not.toEqual(
            hashGrapherChecksumsObj(
                checksums({ deprecationNoticeMd5: "T2vJ8vGZ0k0DkWCkQ2fS9w==" })
            )
        )
    })
})
