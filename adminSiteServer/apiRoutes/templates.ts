import { TemplateDoc } from "@ourworldindata/types"

// The gdoc template registry is generated in CI by
// devTools/gdocs/generate-gdocs-references.ts and committed to the repo, so
// we can serve it without touching the database: one entry per writable gdoc
// type — front-matter fields, admin-managed fields, and the curated skeleton.
import templatesRegistry from "../../docs/templates.registry.generated.json"

export async function getTemplatesReference(): Promise<{
    templates: TemplateDoc[]
}> {
    return { templates: templatesRegistry as TemplateDoc[] }
}
