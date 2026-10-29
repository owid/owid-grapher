import { BespokeVizRegistry } from "@ourworldindata/types"

// The bespoke viz registry is generated in CI by
// devTools/gdocs/generate-gdocs-references.ts and committed to the repo,
// so we can serve it directly without touching the database.
import bespokeVizRegistry from "@ourworldindata/types/src/gdocTypes/bespoke-viz.registry.generated.json"

export async function getBespokeVizReference(): Promise<BespokeVizRegistry> {
    return bespokeVizRegistry as BespokeVizRegistry
}
