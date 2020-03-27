FROM mysql:5.7

ENV MYSQL_ALLOW_EMPTY_PASSWORD=yes
ENV MYSQL_DATABASE=owid
ENV DB_NAME=owid

ADD https://files.ourworldindata.org/owid_metadata.sql.gz /docker-entrypoint-initdb.d/00-metadata.sql.gz
ADD https://files.ourworldindata.org/owid_chartdata.sql.gz /docker-entrypoint-initdb.d/01-data.sql.gz
# https://github.com/docker-library/mysql/issues/624
RUN chmod 0777 /docker-entrypoint-initdb.d/*


#http://web.archive.org/web/20200324170901/https://city.opendata.by/
#MYSQL_ALL
