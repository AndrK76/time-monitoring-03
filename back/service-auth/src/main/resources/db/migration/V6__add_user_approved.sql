ALTER TABLE users  ADD is_approved BOOLEAN;
update users set is_approved=true;