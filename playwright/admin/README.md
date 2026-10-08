# Chart editor browser tests

Playwright tests for the admin's chart editor. Nearly every editor control has a
test that checks it changes the right field in the chart's config. The suite also
tests the public Grapher page in a sandboxed iframe through the chart preview route.

```bash
yarn testPlaywrightAdmin                  # the whole suite
yarn testPlaywrightAdmin mapTab           # one file
yarn testPlaywrightAdmin --grep "log/linear"
```

The run starts its own stack (via `db/tests/run-db-tests.sh`): the db-test MySQL
container, migrations, builds of the admin and site clients, and the admin server on port 8765.

## How it works

- **Data.** `fixture.ts` defines a few synthetic entities and indicators with
  deterministic values. `server.ts` seeds them into the test database and serves
  their data and metadata files in place of the data API. Requests to any other
  host are blocked.
- **Isolation.** Each test seeds the chart it needs through the admin API, so
  tests share only the read-only indicators and run in parallel without cleanup.
- **Tests.** `harness.ts` provides the vocabulary: `seedChart`, `openEditor`, and
  a `ChartEditorPage` with locators for tabs, sections and fields. Its
  `saveChanges()` saves the chart and returns the changed config paths (e.g.
  `{ "map.colorScale.baseColorScheme": "Reds" }`), so tests can assert exactly
  what a control changed. `charts.ts` has config builders for each chart type.
- **Files.** There is one test file per editor tab, plus files for the save buttons
  and the editor around the tabs. `grapherSandbox.test.ts` loads the public site's
  entrypoint inside a real `sandbox="allow-scripts"` iframe, checking startup and
  chart/table interactions when cookies and storage are unavailable. The test
  server enables CORS for the assets requested from the iframe's opaque origin.

A test looks like this:

```ts
test("editing the subtitle writes it to the config", async ({
    seedChart,
    openEditor,
}) => {
    const editor = await openEditor(
        await seedChart(lineChart(indicators.lifeExpectancy))
    )
    await editor.openTab("Text")
    await editor.fill(editor.field("Subtitle"), "A new subtitle")

    expect(await editor.saveChanges()).toEqual({ subtitle: "A new subtitle" })
})
```

## Known bugs

A test marked `test.fail()` describes correct behavior that the editor doesn't
have yet; a comment next to it explains the bug. When the bug is fixed, the test
starts "failing" as an unexpected pass: remove the `test.fail()`.

## Options

| Variable                                     | Effect                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_TEST_VITE_DEV=1`                      | Serves both clients from a Vite dev server instead of builds: starts faster, but page loads are slower                                                                      |
| `ADMIN_TEST_PORT=<port>`                     | Moves the admin server (and the Vite and data API ports after it), e.g. to run two suites side by side                                                                      |
| `GRAPHER_TEST_DB_NAME=<name>`                | Uses another test database, also for running suites side by side (only with `DBTEST_USE_EXISTING_DB=1`: Docker runs share one container, which each run stops when it ends) |
| `DBTEST_USE_EXISTING_DB=1`                   | Uses a running MySQL instead of starting the Docker container (the database needs the pre-migrations schema)                                                                |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<path>` | Uses a preinstalled Chromium, e.g. in sandboxes that can't download browsers                                                                                                |
