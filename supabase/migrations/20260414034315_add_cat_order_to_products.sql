
-- Add Price and Category Sorting columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cat_order INTEGER DEFAULT 0;
