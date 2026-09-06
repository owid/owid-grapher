# Grapher browser workflow contracts

Run `yarn playwright install chromium`, then `yarn testGrapherBrowser`.
The command builds the actual Grapher, MultiDim, MultiEmbedder and site SCSS using
our shared Vite plugins and browser target, then serves the bundle on port 8791.
It needs no database or baked production content. All indicator/config responses
are small local fixtures; other external requests are blocked.

The four scenarios protect tab/time/entity URL restoration, independent hydrated
embeds, late multidimensional data responses, and pinned touch legend selection.
The loading test releases an older response only after the newer view's values
are visible. Expected table values are independent of the implementation.
The touch test verifies the visible highlighted swatch remains after pointer
release/mouse movement and clears on an outside touch.

Initial execution policy: opt-in locally or manually in CI, desktop Chromium
plus a touch-enabled Chromium context. This adds no required merge check and
leaves the existing BDD browser matrix unchanged. The checked-in CI workflow
runs no browser suite; the checked-in Buildkite workflow only handles staging
cleanup. External Buildkite browser coverage is not established by this checkout.
Confirm external coverage and agree ownership/runtime budgets before making this
suite required or expanding its browser matrix.

Failures retain screenshots and traces under `test-results/`; the HTML report is
`playwright-report/grapher/`. Use `yarn playwright show-report playwright-report/grapher`
or `yarn playwright show-trace <trace.zip>`. Retries are disabled so failures remain
visible. Config/data routing is test infrastructure; production callbacks and
renderers are not replaced.
