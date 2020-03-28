FROM mysql:5.7 as builder

ENV MYSQL_ALLOW_EMPTY_PASSWORD=yes
ENV MYSQL_DATABASE=owid
ENV DB_NAME=owid

ADD https://files.ourworldindata.org/owid_metadata.sql.gz /docker-entrypoint-initdb.d/00-metadata.sql.gz
ADD https://files.ourworldindata.org/owid_chartdata.sql.gz /docker-entrypoint-initdb.d/01-data.sql.gz
# https://github.com/docker-library/mysql/issues/624
RUN chmod 0777 /docker-entrypoint-initdb.d/*
# Explicitly trigger database import to speed up mysqld startup in final image.
# --datadir is changed because default is volume that does not persist.
# https://serverfault.com/questions/796762/creating-a-docker-mysql-container-with-a-prepared-database-scheme/915845#915845
RUN ["/entrypoint.sh", "--datadir", "/init-db"]


FROM mysql:5.7

COPY --from=builder /init-db /var/lib/mysql

