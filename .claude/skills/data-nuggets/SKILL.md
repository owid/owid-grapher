---
name: data-nuggets
description: One-shot data-nuggets pipeline — given one or more OWID chart slugs (with existing investigation reports in data-nuggets/reports/), generate nuggets, fact-check them, refine them, and push the drafts to the admin DB for review, then clean up the local working files. Wraps the five discrete pipeline skills (investigate-chart → generate → fact-check → refine → push) so you don't have to invoke them one by one.
metadata:
    internal: true
---

# Data nuggets (full pipeline)

Run the whole data-nuggets pipeline end to end for one or more charts, landing the
result as private drafts in the admin DB (`/admin/agentic-writing`) for review.
This is the convenience wrapper over the discrete skills — reach for those
directly when you want manual control over a single stage.

## Input

One or more chart slugs (single-chart or `+`-joined multi-chart keys), e.g.
`child-mortality` or `gdp-per-capita-worldbank+co-emissions-per-capita`. The
pipeline expects an investigation to exist; if no report is found it runs one.

## Auth (required for the push at the end)

Same as `push-data-nuggets`. Confirm both are set before starting; if not, ask
the user for them and stop rather than generating work that can't be pushed:

```bash
echo "$OWID_ADMIN_BASE"      # e.g. http://staging-site-data-nuggets/admin/api
echo "${OWID_ADMIN_API_KEY:+set}"
```

## Steps

Process each input key **independently and sequentially** (one key fully through
the pipeline before starting the next), so a failure on one doesn't strand the
others. For each key:

1. **Investigation.** Look for an existing report at
   `data-nuggets/reports/{key}-*.html`. If one exists, use the most recent. If
   none exists, run the **investigate-chart** skill for the key first.

2. **Generate.** Run the **generate-data-nuggets** skill for the key, passing the
   report path. It writes a working file at
   `data-nuggets/views/{key}-{ts}.json` (`status: "draft"`). Capture that path —
   call it `$FILE`; it threads through the next three steps.

3. **Fact-check.** Run the **fact-check-data-nuggets** skill on `$FILE`. It
   mutates `$FILE` in place to `status: "fact-checked"`.

4. **Refine.** Run the **refine-data-nuggets** skill on `$FILE`. It mutates
   `$FILE` in place to `status: "refined"`.

5. **Push.** Run the **push-data-nuggets** skill on `$FILE`. Each view becomes a
   private-draft lineage owned by the calling user. Record `inserted` /
   `skipped` from its summary.

6. **Clean up the working file.** Once the push for `$FILE` has **succeeded**,
   delete it (`rm "$FILE"`) along with any scratch files the stages wrote under
   `data-nuggets/.scratch/`. The DB is now the source of truth for that nugget;
   the local JSON was only a working artifact.
    - **Do not delete on failure.** If any of steps 2–5 errored, leave `$FILE` in
      place so the partial work can be inspected/resumed, and report which stage
      failed. Never delete `data-nuggets/reports/` — those investigations are
      reused.

## Output

A one-line summary per key plus a total, e.g.:
`child-mortality: 5 pushed · co-emissions-per-capita: 18 pushed (2 skipped) — 23 lineages now in review at $OWID_ADMIN_BASE`.

## Notes

- **Re-runs create new lineages.** Because the working file is deleted after a
  successful push, a later run generates a fresh file with a new timestamp (hence
  a new `sourceId`), so it won't dedupe against earlier runs the way re-pushing
  the _same_ file does. Generate a key once per intended batch.
- Keep the stages observable: report progress per stage so a long multi-key run
  isn't a silent black box.
