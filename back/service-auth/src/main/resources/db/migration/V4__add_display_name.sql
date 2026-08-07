ALTER TABLE users  ADD display_name  VARCHAR(255);
update users set display_name = first_name ||' '||last_name;