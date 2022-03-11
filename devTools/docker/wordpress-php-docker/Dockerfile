FROM php:8.0-fpm

RUN apt-get update && apt-get install -y \
    git \
    unzip \
    mariadb-client \
    libmariadb-dev \
 && docker-php-ext-install mysqli  \
 && rm -rf /var/lib/apt/lists/*

 RUN pecl install xdebug \
    && docker-php-ext-enable xdebug

RUN curl https://getcomposer.org/download/latest-2.2.x/composer.phar --output /usr/local/bin/composer \
    && chmod +x /usr/local/bin/composer
WORKDIR /app
