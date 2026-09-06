# Search response contracts

`yarn test run functions/api/search/searchApi.test.ts` runs deterministic API
contracts. The real search implementation and Algolia lite client run against a
stubbed HTTP transport. Fixtures explicitly contain all three chart result types
and eight public page types, including internal fields that must not escape.
Tests cover canonical/custom-base URLs, query parameters, page/offset forwarding,
response metadata, empty results and invalid-versus-empty topics with the full
facet limit. The lower-level facet/matching tests remain separate.

`yarn test run functions/api/search/searchApi.integration.test.ts` runs seven live
Algolia/index contracts: country filtering, all-country filtering, topic filtering,
rare valid topics with empty results, chart pagination, page pagination and page
type filtering. Their unchanged assertions retain evidence about the real index
that a controlled response cannot establish. They use the existing public search
credentials and must have network access.

`yarn test run functions/test/search.e2e.test.ts` retains real Workers plus live
Algolia compatibility. `yarn test run functions/test/grapher-config-r2.e2e.test.ts`
is different: it uses local Workers/R2 and is deterministic. It remains untouched.

All four files are currently in the default Vitest inventory and run in the main
CI workflow's `test` job. The live files are **not opt-in** merely because dedicated
scripts also exist. This PR does not change execution policy or exclude local R2
coverage. Use the focused deterministic command when working offline.

## Preservation mapping

No retained live test is structurally rewritten. Removed response assertions move
to the following explicit, controlled scenarios; input query words in the old
smoke tests were examples, not promises of specific index records.

| Existing live assertions                                                                 | Retained evidence                                                                                               |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Chart query echo, nonempty bounded results, required fields and chart/explorer URL shape | Exact three-type deterministic response; real-index nonempty/filter/pagination checks remain live               |
| One-country and all-country positive results; topic results                              | Same live tests, unchanged; existing deterministic facet tests still cover request rules                        |
| Unknown topic throws with available-topic guidance                                       | Exact deterministic validation error and full facet request                                                     |
| Polio is valid even when the query finds no hits                                         | Same live test plus deterministic rare-topic/empty response                                                     |
| Chart pages 0/1, page size, exact lengths, distinct first slugs                          | Same live pagination test plus deterministic request/response metadata                                          |
| Conditional chart/explorer URLs                                                          | Both types are mandatory in the fixture; multi-dimensional query URLs added                                     |
| Chart internal-field removal and required fields                                         | Exact deterministic response includes internal fields in the input and excludes them from every output          |
| Empty chart query and query echo                                                         | Deterministic empty response, also rejects a spurious closest-matches flag                                      |
| Custom chart base URL                                                                    | Exact deterministic pagination result URL                                                                       |
| Banana/climate page query echo, bounded positive results, required fields and URL        | Explicit typed page fixture and exact output; live page-filter and pagination checks retain real-index evidence |
| Page offsets, page sizes, exact lengths, distinct first slugs                            | Same live pagination test plus deterministic SDK offset/length assertions                                       |
| About-page results are nonempty and have the requested type                              | Same live test, unchanged; deterministic request filters and output type assertions                             |
| Data-insight URL prefix                                                                  | Mandatory data-insight fixture, with seven other canonical page-type paths                                      |
| Page internal-field removal                                                              | Exact output for all eight page types; additionally reject leaked ranking metadata                              |
| Empty page query and custom base URL                                                     | Deterministic empty scenario and exact custom-base page URLs                                                    |

This separates reproducible response behavior from live service evidence; it is
not based on an observed search outage or measured performance regression.
