import { defineConfig } from "bumpp"

// master is push-protected: bumpp pushes the bump on a release branch and opens
// a PR. No tag is created locally; .github/workflows/tag-package-releases.yml
// tags the merge commit.
export default defineConfig({
    commit: "chore: release gdoc-pipeline@{version}",
    tag: false,
    pr: {
        branch: "release/gdoc-pipeline-{version}",
    },
})
