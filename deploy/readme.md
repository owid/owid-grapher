# Deploy

This folder contains code for baking and deploying the live site.

(Note: Some of the baking code is still in site/.)

## Watch.ts

Currently we use pm2 to run the Watch.ts process. This process creates a deploy queue when an author makes a change.

It used to be embedded as part of `adminSite` and a deploy process was spawned every time there was a deploy. The issue at the time was that we'd have multiple processes deploying simultaneously and very rarely it would lead to broken content (e.g. js deployed while webpack is generating it). The other issue was that these processes, for some unknown reason, sometimes didn't exit cleanly, and would hang around as zombies.

The current single-process-deploy provides some simplicity when dealing with queues – e.g. no simultaneous deploys; a new deploy automatically starts if there are items in the queue at the end of a deploy. Also no TS compilation needs to happen (pretty minor but saves 10-15 seconds each deploy). It's also much easier to shut down, e.g. when we run a code deploy, we can easily kill the process to ensure multiple deploys aren't running.
