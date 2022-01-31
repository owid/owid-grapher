#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

# The wordpress init scripts need to be able to scp from the live owid server.
# For this to work we mount the users ~/.ssh directory into /user/.ssh inside the
# container and then here we now have to copy the content to /root/.ssh and
# change the permissions

setupSSH() {
    echo "Setting up users .ssh directory within mysql init docker container"
    cp -r /user/.ssh /root/.ssh
    chmod 600 /root/.ssh/*
    echo "SSH setup done"
}