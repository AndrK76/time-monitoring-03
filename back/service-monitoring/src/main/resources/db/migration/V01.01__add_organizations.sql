CREATE TABLE organizations
(
    id                 VARCHAR(255) NOT NULL,
    short_name         VARCHAR(40)  NOT NULL,
    full_name          VARCHAR(255) NOT NULL,
    CONSTRAINT pk_organizations PRIMARY KEY (id)
);

