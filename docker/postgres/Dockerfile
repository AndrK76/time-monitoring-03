FROM postgres:16-alpine
COPY 01-init.sh /docker-entrypoint-initdb.d/01-init.sh
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/01-init.sh
RUN chmod +x /docker-entrypoint-initdb.d/01-init.sh
EXPOSE 5432