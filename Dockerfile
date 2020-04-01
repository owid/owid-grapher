FROM mysql:5.7 as builder

ENV MYSQL_ALLOW_EMPTY_PASSWORD=yes
ENV MYSQL_DATABASE=owid
ENV DB_NAME=owid

ADD https://files.ourworldindata.org/owid_metadata.sql.gz /docker-entrypoint-initdb.d/00-metadata.sql.gz
ADD https://files.ourworldindata.org/owid_chartdata.sql.gz /docker-entrypoint-initdb.d/01-data.sql.gz
# https://github.com/docker-library/mysql/issues/624
RUN chmod 0777 /docker-entrypoint-initdb.d/*

# Explicitly trigger database import to speed up mysqld startup in final image.
# https://serverfault.com/questions/796762/creating-a-docker-mysql-container-with-a-prepared-database-scheme/915845#915845

# prevent mysqld from starting after DB import
RUN ["sed", "-i", "s/exec \"$@\"/echo \"skipping $@\"/", "/entrypoint.sh"]

# --datadir is changed because default is volume that does not persist.
RUN ["/entrypoint.sh", "--datadir", "/init-db"]



### real container #################################################

FROM mysql:5.7

COPY --from=builder /init-db /var/lib/mysql
COPY . /app

ENV MYSQL_ALLOW_EMPTY_PASSWORD=yes
ENV MYSQL_DATABASE=owid
ENV DB_NAME=owid

# Installing Node.js 12.x and Yarn
RUN set -x \
      && apt-get update && apt-get install -y curl jq git build-essential \
      && NODE_VERSION=$(jq -r .engines.node /app/package.json) \
      && DEB_FILE="nodejs_${NODE_VERSION}-1nodesource1_amd64.deb" \
      && curl -sLO "https://deb.nodesource.com/node_12.x/pool/main/n/nodejs/${DEB_FILE}" \
      && apt-get install -y ./"${DEB_FILE}" && rm "${DEB_FILE}" \
      && curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
      && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
      && apt-get update && apt-get install -y yarn \
      && rm -rf /var/lib/apt/lists/*

#RUN cd app && yarn

