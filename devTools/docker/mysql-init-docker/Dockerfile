FROM mysql/mysql-server:latest

RUN microdnf -y update \
 && microdnf install --nogpgcheck -y mysql-shell \
 && microdnf install -y \
    libpwquality \
    curl \
    rsync \
    unzip \
    gzip
