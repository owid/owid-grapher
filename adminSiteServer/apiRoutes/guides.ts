import { GuideReference } from "@ourworldindata/types"

// The gdoc guides registry is generated in CI by
// devTools/gdocs/generate-gdocs-references.ts and committed to the repo, so
// we can serve it without touching the database: one entry per guide — the
// cross-cutting concepts of writing in Google Docs.
import guidesRegistry from "../../docs/guides.registry.generated.json"

export async function getGuidesReference(): Promise<{
    guides: GuideReference[]
}> {
    return { guides: guidesRegistry as GuideReference[] }
}
