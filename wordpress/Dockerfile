FROM php:7.4-fpm

RUN apt-get update && apt-get install -y \
    git \
    unzip \
    mariadb-client \
    libmariadb-dev \
 && docker-php-ext-install mysqli  \
 && rm -rf /var/lib/apt/lists/*

RUN curl https://getcomposer.org/download/latest-2.2.x/composer.phar --output /usr/local/bin/composer \
    && chmod +x /usr/local/bin/composer
RUN groupadd -r wordpress && useradd --no-log-init -r -g wordpress wordpress
COPY --chown=wordpress:wordpress composer.* /app/
COPY --chown=wordpress:wordpress .env /app/
COPY --chown=wordpress:wordpress phpcs.xml /app/
COPY --chown=wordpress:wordpress wp-cli.yml /app/
COPY --chown=wordpress:wordpress config /app/config
COPY --chown=wordpress:wordpress web /app/web
USER wordpress
WORKDIR /app
RUN composer install --no-interaction