// Types for the generated ArchieML component reference registry.
// Produced by devTools/gdocs/generate-components-reference.ts (committed to
// docs/components.registry.generated.json) and consumed by the admin
// components reference page via the /api/components.json endpoint.

export interface ComponentExample {
    name: string
    archie: string
}

export interface ComponentDoc {
    id: string
    title: string
    typeName: string
    sourceFile: string
    sidecarFile: string
    body: string
    examples: ComponentExample[]
}
