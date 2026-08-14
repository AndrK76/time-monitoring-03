CREATE TABLE app_users
(
    id           VARCHAR(255) NOT NULL,
    username     VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    is_valid     BOOLEAN,
    roles        TEXT,
    CONSTRAINT pk_app_users PRIMARY KEY (id)
);

ALTER TABLE app_users
    ADD CONSTRAINT uc_app_users_username UNIQUE (username);