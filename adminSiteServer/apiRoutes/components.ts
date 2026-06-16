import { ComponentDoc } from "@ourworldindata/types"

// The ArchieML component registry is generated in CI by
// devTools/gdocs/generate-components-reference.ts and committed to the repo, so
// we can serve it directly to the admin components reference page without
// touching the database. See docs/component-reference-admin-plan.md.
import componentsRegistry from "../../docs/components.registry.generated.json"

export async function getComponentsReference(): Promise<{
    components: ComponentDoc[]
}> {
    return { components: componentsRegistry as ComponentDoc[] }
}
