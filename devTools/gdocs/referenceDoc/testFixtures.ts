/*
 * Small registries for the reference-doc tests: four components across two
 * categories (one system, one auto-generated), one template, two guides.
 */

import type {
    ComponentRegistry,
    GuideReference,
    TemplateReference,
} from "@ourworldindata/types"
import componentsFixture from "../fixtures/referenceDoc/components.json"
import templatesFixture from "../fixtures/referenceDoc/templates.json"
import guidesFixture from "../fixtures/referenceDoc/guides.json"
import type { ReferenceRegistries } from "./buildModel.js"

export const fixtureRegistries: ReferenceRegistries = {
    components: (componentsFixture as ComponentRegistry).components,
    templates: templatesFixture as TemplateReference[],
    guides: guidesFixture as GuideReference[],
}
