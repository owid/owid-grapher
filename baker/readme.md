# Baker

This folder contains code for baking and deploying the live site.

## Deploys

Admin edits don't bake anything themselves. A route that changes something the site shows calls `enqueueDeployChange(trx, user, message)` (`DeployUtils.ts`). Once the route's transaction commits, all its changes go out as one Buildkite build of the content deploy pipeline (`BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG`, for `BUILDKITE_BRANCH`), requested and not waited for; a rolled-back edit requests nothing. Every build is a full bake. The build carries `DEPLOY_REQUESTED_AT`, so the ops scripts can skip its bake when a full bake that started after it has already gone out, which keeps a burst of edits to about two bakes. A failed request goes to Sentry and the edit goes out with the next deploy.

Nothing is requested unless `BAKE_ON_CHANGE` is set, which it isn't in local dev: the dev server renders pages on demand, and `make local-bake` bakes the whole site.

The admin's `/deploys` page lists the pipeline's recent builds and has a button to request one.
