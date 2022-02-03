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
WORKDIR /app
