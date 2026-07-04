// Component catalog: everything the agent needs to know about ArchieML
// components, derived from the vendored code wherever possible so it cannot
// drift from the parser that will validate the agent's output.
//
// - the canonical component list and full examples come from the vendored
//   exampleEnrichedBlocks (a Record keyed by every member of the enriched
//   block union — exhaustive by construction);
// - minimal examples and required/optional field info are PROBED: drop a
//   field from the example, serialize, re-parse — the vendored parser is the
//   oracle for what is optional;
// - prose descriptions live in componentDescriptions.ts (hand-curated,
//   seeded from the official OWID authoring docs) and real-world usage
//   examples in componentExamples.ts (mined from the production gdocs DB by
//   scripts/mine-component-examples.ts) — both are plain data modules so a
//   future component gallery can render them.

import { enrichedBlockExamples } from "./exampleEnrichedBlocks.js";
import { enrichedBlockToXhtml, prettyPrintXhtml } from "./enrichedToXhtml.js";
import { xhtmlToEnrichedBlocks } from "./xhtmlToEnriched.js";
import { traverseEnrichedBlock } from "@ourworldindata/utils";
import type { OwidEnrichedGdocBlock } from "@ourworldindata/types";
import { componentDescriptions } from "./componentDescriptions.js";
import { componentExamples } from "./componentExamples.js";

export type ComponentType = OwidEnrichedGdocBlock["type"];

export interface ComponentDescription {
  description: string;
  whenToUse?: string;
  notes?: string;
  /** e.g. "topic pages only", "homepage only" */
  pageTypes?: string;
}

export interface RealExample {
  slug: string;
  gdocType: string;
  xhtml: string;
}

export interface ComponentUsage {
  /** occurrences across published prod gdocs at mining time */
  count?: number;
  examples: RealExample[];
}

export interface ComponentDetail extends ComponentDescription {
  type: ComponentType;
  /** example with only the required fields */
  minimalXhtml: string;
  /** example with all fields populated */
  fullXhtml: string;
  requiredFields: string[];
  optionalFields: string[];
  /** real production usage (provenance: published OWID gdocs) */
  realExamples: RealExample[];
  /** total occurrences in published production gdocs at mining time */
  prodUsageCount?: number;
}

const descriptions: Record<string, ComponentDescription> = componentDescriptions;
const realExamples: Record<string, ComponentUsage> = componentExamples;

// Internal value types that never appear as standalone body blocks (and do
// not round-trip as one) — excluded from the authorable catalog.
const NON_AUTHORABLE = new Set<ComponentType>(["simple-text"]);

export const componentTypes = (): ComponentType[] =>
  (Object.keys(enrichedBlockExamples) as ComponentType[]).filter((t) => !NON_AUTHORABLE.has(t));

export const componentDescription = (type: ComponentType): ComponentDescription =>
  descriptions[type] ?? { description: "(no description available)" };

/** Collect parse errors from a block and all nested blocks. */
export const collectBlockErrors = (block: OwidEnrichedGdocBlock): string[] => {
  const out: string[] = [];
  traverseEnrichedBlock(block, (b) => {
    for (const e of b.parseErrors ?? [])
      out.push(e.isWarning ? `warning: ${e.message}` : e.message);
  });
  return out;
};

/** Does this enriched block serialize+parse cleanly back to its own type? */
const parsesCleanly = (block: Record<string, unknown>, type: string): boolean => {
  try {
    const xhtml = enrichedBlockToXhtml(block as never);
    const back = xhtmlToEnrichedBlocks(xhtml);
    if (back.length !== 1 || back[0]!.type !== type) return false;
    return collectBlockErrors(back[0]!).filter((e) => !e.startsWith("warning:")).length === 0;
  } catch {
    return false;
  }
};

interface ProbeResult {
  minimal: Record<string, unknown>;
  requiredFields: string[];
  optionalFields: string[];
}

/**
 * Determine required vs optional fields by dropping each in turn and asking
 * the parser. `parseErrors` and `type` are bookkeeping, not content fields.
 */
const probeFields = (type: ComponentType): ProbeResult => {
  const example = enrichedBlockExamples[type] as unknown as Record<string, unknown>;
  const fields = Object.keys(example).filter((k) => k !== "type" && k !== "parseErrors");
  const optional: string[] = [];
  const required: string[] = [];
  for (const field of fields) {
    const candidate = { ...example };
    delete candidate[field];
    (parsesCleanly(candidate, type) ? optional : required).push(field);
  }
  // build the minimal block by dropping optional fields cumulatively,
  // re-adding any whose removal only parses in isolation
  const minimal = { ...example };
  for (const field of optional) {
    const candidate = { ...minimal };
    delete candidate[field];
    if (parsesCleanly(candidate, type)) delete minimal[field];
  }
  return { minimal, requiredFields: required, optionalFields: optional };
};

const detailCache = new Map<ComponentType, ComponentDetail>();

export const describeComponent = (type: ComponentType): ComponentDetail => {
  const cached = detailCache.get(type);
  if (cached) return cached;
  const example = enrichedBlockExamples[type];
  if (!example) throw new Error(`unknown component type "${type}"`);
  const { minimal, requiredFields, optionalFields } = probeFields(type);
  const usage = realExamples[type];
  const detail: ComponentDetail = {
    type,
    ...componentDescription(type),
    minimalXhtml: prettyPrintXhtml(enrichedBlockToXhtml(minimal as never)),
    fullXhtml: prettyPrintXhtml(enrichedBlockToXhtml(example)),
    requiredFields,
    optionalFields,
    realExamples: usage?.examples ?? [],
  };
  if (usage?.count !== undefined) detail.prodUsageCount = usage.count;
  detailCache.set(type, detail);
  return detail;
};

/** One line per component — the compact catalog for the agent's context. */
export const catalogSummary = (): string =>
  componentTypes()
    .map((type) => {
      const d = componentDescription(type);
      let line = `${type} — ${d.description}`;
      if (d.pageTypes) line += ` (${d.pageTypes})`;
      return line;
    })
    .join("\n");
