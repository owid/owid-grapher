import { ComponentRegistry } from "@ourworldindata/types"

// The ArchieML component registry is generated in CI by
// devTools/gdocs/generate-gdocs-references.ts and committed to the repo,
// so we can serve it directly without touching the database.
import componentsRegistry from "../../docs/components.registry.generated.json"

export async function getComponentsReference(): Promise<ComponentRegistry> {
    return componentsRegistry as ComponentRegistry
}
