-- Branch self-service pre-order:
--  • a per-branch password (admin-set, stored HASHED) on customers
--  • a flag marking orders that a branch submitted itself via /preorder
alter table customers add column if not exists preorder_password_hash text;
alter table orders add column if not exists is_preorder boolean not null default false;
