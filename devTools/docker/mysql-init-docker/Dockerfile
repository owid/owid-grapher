FROM mysql:8

RUN rpm --import https://repo.mysql.com/RPM-GPG-KEY-mysql-2023 \
 && microdnf -y update \
 && microdnf install -y \
    libpwquality \
    curl \
    rsync \
    unzip \
    gzip \
 && microdnf clean all
