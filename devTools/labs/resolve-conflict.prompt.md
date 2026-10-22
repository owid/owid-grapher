You're resolving a git merge conflict while building Labs, a staff-only copy of ourworldindata.org with experimental features switched on. The `labs` branch is rebuilt from scratch: master, then every open PR labelled `labs`, merged one after another. Staff use the result in their daily work.

The working tree is in the middle of one of those merges. `HEAD` is master plus the Labs PRs merged before this one; the incoming side is the PR described below. The conflicted files are listed below too.

Resolve the conflicts so that both sides keep working: the features already on Labs and this PR's change. Each PR was written against master without knowing about the others, so read what each side is trying to do before combining them. Edit only the conflicted files: later rebuilds replay the resolution of those files and nothing else, and the build script rejects changes anywhere else. If the combination also needs a change in another file (an import, a renamed function), leave the markers in place and say so. Nobody reviews this merge before staff use it, and it never reaches master (each PR is merged there separately, by its author), so prefer the resolution least likely to break either feature over a cleverer one.

If you can't tell how two changes should combine, leave that file's conflict markers in place. The PR is then left out of this Labs build and its author resolves it, which is much better than a guess that quietly breaks a feature.

git shows you each side: `git log --merge -p` for the commits involved, `git diff` for the current conflict, `git show` for anything else. Don't stage or commit; the build script checks that the result typechecks and commits it.

Your final message is copied word for word into the Labs PR description, next to this PR, so make it only one or two sentences saying how you combined the changes: no headings, code blocks or notes about the process. If you left markers in place, say which file and why.
