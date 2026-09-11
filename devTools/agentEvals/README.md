# Agent evals: can an agent answer from our chart pages?

Measures whether the text an agent gets from a `/grapher/<slug>` page lets it
answer factual questions about the chart. Built to judge
[#7224](https://github.com/owid/owid-grapher/pull/7224), which adds
`/grapher/<slug>.md`, and reusable for anything else that changes what a
non-JavaScript reader sees (llms.txt, page markdown, WebMCP text).

Two layers, cheapest first:

| Layer          | Question                                                                        | Model? | Script                                             |
| -------------- | ------------------------------------------------------------------------------- | ------ | -------------------------------------------------- |
| 0. Value check | Does every number printed in the markdown match the chart's CSV?                | no     | `checkMarkdownValues.ts`                           |
| 1. Document QA | Given the page text, does an agent answer correctly, and does it stop guessing? | yes    | `buildCases.ts` → `runDocQa.ts` → `buildReport.ts` |

Everything runs from the repo root with `yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/<script>`.

## Conditions

The same question is asked under three renderings of the same URL:

- **today**: the production page fetched with `Accept: text/markdown`, which is Cloudflare's HTML→markdown conversion. This is what a crawler or LLM agent that does not run JavaScript reads now: description, sources, FAQ, but no numbers.
- **pr**: `/grapher/<slug>.md` from the PR branch's staging server (`staging-site-<prBranch>` in `charts.json`).
- **none**: no page at all. A control that shows how much of a correct answer comes from the model's memory rather than the page. It also shows what an agent does when the page is useless: guess, or say so.

The agent is `claude -p` with no tools; the page is handed over in the user
message as "the content I fetched", and the answer comes back as structured
JSON (`answer_number`, `answer_entity`, `answer_text`, `found_in_page`,
`evidence`). It runs on the developer's Claude subscription, so no API key is
needed; the reported cost is what the calls would cost on the API.

## Cases

`buildCases.ts` derives ~110 questions from the views in `charts.json`, all
with gold answers taken from the CSV and metadata endpoints, never from the
markdown under test. Per chart view:

| Type                        | Asks for                                                                | Answerable from the PR markdown via     |
| --------------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| `point-latest` ×2           | a random country's value at its latest year                             | the per-entity table                    |
| `point-selected`            | a default-selected entity at the view's end year                        | either table                            |
| `point-start`               | the first selected entity at the view's start year                      | the selected-values table               |
| `change`                    | end minus start for that entity                                         | the selected-values table               |
| `rank-max` / `rank-min`     | the country with the highest / lowest value                             | the per-entity table                    |
| `unanswerable-early`        | a value for a year before the entity's data starts                      | nothing: the right answer is to decline |
| `unanswerable-late`         | a value for the view's end year from a country whose data stops earlier | nothing: the right answer is to decline |
| `meta-unit` / `meta-source` | the unit and the data producers                                         | the prose, present in both renderings   |

Sampling is seeded per chart, so re-running on unchanged data reproduces the
set. `cases.json` is committed and is the thing to review: read the questions,
and check a few gold values against the chart.

## Grading

Programmatic, no judge model:

- **correct**: numbers within 1% of gold (plus a rounding allowance for
  `change`), an accepted entity name for rankings, the unit or any producer
  name for meta questions, and for unanswerable cases: no number given.
- **from page**: correct, and the `evidence` the agent quoted occurs in the
  page text. Separates "read it off the page" from "knew it anyway".
- **hallucinated**: gave a specific wrong answer, or gave a number where the
  page has none.
- **abstained**: gave no number or entity.

`buildReport.ts` recomputes grades from the stored answers, so a grader fix
never requires re-running the model.

## Running

```sh
# 0. Cheap and deterministic: compare every printed value to the CSV
yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/checkMarkdownValues.ts --verbose

# 1. Regenerate cases (only when charts.json or the data changed)
yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/buildCases.ts

# 2. Run: pilot on two charts, then everything
yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runDocQa.ts --name pilot --model sonnet --filter '^(life-expectancy|population)/'
yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runDocQa.ts --name sonnet-full --model sonnet --concurrency 3

# 3. Report (opens in Chrome)
yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/buildReport.ts --run sonnet-full
```

Useful flags on `runDocQa.ts`: `--conditions today,pr`, `--model haiku|sonnet|opus`,
`--effort low`, `--reps 2`, `--filter '<regex over case ids>'`, `--limit N`,
`--refresh-docs` (re-download the page snapshots).

A run is resumable: results are appended per `(case, condition, rep)` as they
complete, and restarting skips what is already there. Failed calls (timeouts,
API errors) go to `errors.jsonl`, never into the scores. Keep `--concurrency`
at 3 or so on a laptop that already runs other Claude sessions; each call is a
separate `claude` process.

## Layout

```
charts.json          chart views under test + the PR branch whose staging serves them
cases.json           generated questions with gold (committed; review this)
lib/                 fetching, CSV/markdown parsing, number parsing, view loading
results/             gitignored: inputs/ (CSV + metadata snapshots), docs/ (page snapshots per condition), runs/<name>/, check/
```

## Caveats

- The `today` snapshot comes from production and the `pr` snapshot and gold
  from staging. `checkMarkdownValues.ts` reports `csv-parity` when the two
  CSVs differ; treat cases on such charts with care.
- Questions are template-generated, not real user questions. They cover the
  lookups the PR's markdown is designed to answer; they say nothing about
  discovery (will an agent find `.md` at all?) or about prose-only content
  such as key insights, which the PR markdown does not carry.
- One rep per case gives a noise floor of roughly ±10 points on a pass rate
  at n ≈ 110. Paired differences between conditions on the same cases are
  much tighter; the report gives bootstrap intervals for those.

## Agents with tools, and the open web

Two extensions to the same runner, both cheap enough to run on a handful of
cases and both meant for reading transcripts rather than computing rates:

- **`+tools` conditions** (`--conditions today+tools,pr+tools`): the agent gets
  Claude Code's default tools and may follow the page's links. Rows gain
  `tool_calls`, `num_turns` and whether the evidence came from a tool result.
  A `custom` page condition reads `results/docs/custom/<chart>.md`, a
  hand-edited snapshot, for wording experiments ("does documenting the query
  grammar change how the agent fetches?").
- **`runOpenWeb.ts`**: generic questions with no mention of Our World in Data
  and no URL; the agent (`--agent claude` or `--agent gemini`, the latter via
  Gemini CLI with `GOOGLE_API_KEY`) has web search and fetch and must name its
  source. Records searches, fetched domains, the cited source and whether the
  number matches our CSV. Both agents run with a private home directory and
  `--setting-sources project`, so none of the developer's skills, memory files
  or hooks are in play; an early run without that had the OWID skills loaded,
  which changed where the agent went.

```sh
yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runDocQa.ts --name tools --conditions 'today+tools' --filter 'life-expectancy/(point-latest-1|rank-max-1)'
yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runOpenWeb.ts --name open-web
yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/runOpenWeb.ts --agent gemini --model gemini-3.8-flash --name open-web-gemini
```

Fetcher behaviour worth knowing when interpreting results: Claude Code's
`WebFetch` sends `Accept: text/markdown, text/html, */*`; Gemini CLI's
`web_fetch` and `curl` send `*/*`. So the "today" condition (Cloudflare's
markdown conversion of the HTML) is what Claude-class fetchers actually read
from a chart page, while Gemini-class fetchers read the HTML.
