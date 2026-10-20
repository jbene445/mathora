FROM postgres:17
COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY data/curriculum.sql /docker-entrypoint-initdb.d/02-curriculum.sql
COPY data/questions.sql /docker-entrypoint-initdb.d/03-questions.sql
COPY data/accounts.sql /docker-entrypoint-initdb.d/04-accounts.sql
EXPOSE 5432
