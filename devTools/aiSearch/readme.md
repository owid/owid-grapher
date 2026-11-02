# AI search comparison

Runs the AI search prototype (`/api/ai-search`) and standard search (`/api/search`) for a list of queries and writes the run to `tmp/ai-search-runs/` as JSON plus an HTML report with both side by side.

```sh
yarn buildAiSearchComparison                          # queries.txt on this branch's staging server
yarn buildAiSearchComparison "food" "obesity"         # just these queries
yarn buildAiSearchComparison --baseline tmp/ai-search-runs/<earlier run>.json
yarn buildAiSearchComparison --host http://localhost:<functions port> --model claude-haiku-5-5
```

With `--baseline`, the report adds the earlier run's AI page as a middle column and the console lists, per query, whether the headline chart changed, how many groups start with a topic page or article, and how much of the content stayed. Use it to check a prompt or model change before and after.

The server needs `/api/ai-search`, which only answers under `wrangler pages dev` with an `ANTHROPIC_API_KEY` (staging servers, or local dev with a key in `.dev.vars`). Each query costs one AI search request, about 5–10 s with the default model; the script runs three at a time.
