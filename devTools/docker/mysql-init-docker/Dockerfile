FROM mysql:5.7

RUN apt-get update && apt-get install -y \
    curl \
    rsync \
    unzip \
    gzip \
    pv \
    openssh-client \
 && rm -rf /var/lib/apt/lists/*
