## Cloudflare Deployment

Deployment is divided into two main parts:

1. **Code Building**: To avoid race conditions, this process is synchronized.
2. **Content Baking and Cloudflare Deployment**: This step can run in parallel.

Both processes are triggered by merging to the `master` branch and run through Buildkite pipelines. Additionally, a deploy queue exclusively triggers the content baking step.

**Important Notes**:

- The scripts operate in `/home/owid/owid-grapher`, not in Buildkite default paths (`$BUILDKITE_BUILD_CHECKOUT_PATH/owid-grapher`).
- Run these scripts only on the `master` branch.
- For testing on different branches, create a new LXC container (e.g., `owid-lxc create -t owid-cloudflare-prod owid-cloudflare-staging`).
