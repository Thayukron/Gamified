# ARCANA PROFILE — PHP API (Apache + mod_php)
FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql \
 && a2enmod headers \
 && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-arcana.ini"
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/arcana-entrypoint
# strip CR in case the repo was checked out on Windows with CRLF line endings
RUN sed -i 's/\r$//' /usr/local/bin/arcana-entrypoint && chmod +x /usr/local/bin/arcana-entrypoint

WORKDIR /var/www/html
COPY . .
# secrets / local overrides never go into the image
RUN rm -rf storage config.local.php docker Dockerfile .dockerignore \
 && mkdir -p storage && chown www-data:www-data storage && chmod 700 storage

ENTRYPOINT ["arcana-entrypoint"]
CMD ["apache2-foreground"]
