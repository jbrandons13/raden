-- SEED DATA FOR RADEN ERP
-- Silakan Copy-Paste ke Supabase SQL Editor

-- 1. Insert Staff
INSERT INTO staff (name, position) VALUES 
('Andi Perkasa', 'Kepala Dapur'),
('Siti Aminah', 'Staff Produksi'),
('Budi Santoso', 'Staff Gudang'),
('Citra Lestari', 'Admin Toko');

-- 2. Insert Products (Barang Jadi)
INSERT INTO products (name, category, initial_stock, current_stock) VALUES 
('Nastar Premium', 'Cookies', 0, 50),
('Kastengel Keju', 'Cookies', 0, 30),
('Putri Salju', 'Cookies', 0, 10),
('Sagu Keju', 'Cookies', 0, 5), -- Low stock for recommendation test
('Bolen Pisang Keju', 'Pastry', 0, 20),
('Bolen Cokelat', 'Pastry', 0, 15);

-- 3. Insert Materials (Bahan Baku)
INSERT INTO materials (name, category, qty, unit, notes) VALUES 
('Tepung Terigu Segitiga', 'Tepung', 25.5, 'Kg', 'Beli karungan 25kg'),
('Mentega Wijsman', 'Dairy', 5, 'Kg', 'Stok mahal, gunakan hemat'),
('Keju Kraft Cheddar', 'Dairy', 10, 'Block', 'Beli di agen'),
('Telur Ayam', 'Lainnya', 15, 'Tray', 'Cek kesegaran tiap pagi'),
('Gula Pasir', 'Lainnya', 20, 'Kg', NULL),
('Selai Nanas Home-made', 'Buah', 8, 'Kg', 'Produksi tiap Senin');

-- 4. Insert Customers (Reseller/Toko)
INSERT INTO customers (name, address, phone) VALUES 
('Toko Maju Jaya', 'Jl. Merdeka No. 10, Bandung', '08123456789'),
('Warung Bu Endang', 'Jl. Melati No. 5, Jakarta', '08198765432'),
('Reseller Pak Dedi', 'Online / WhatsApp', '08567891234'),
('Kantin Kantor Pusat', 'Gedung Wisma, Lt. 1', '08212121212');

-- 5. Insert some initial Tasks (Optional)
-- (Will appear in Staff Jobdesk)
INSERT INTO tasks (product_id, staff_id, expected_qty, notes, status) 
SELECT p.id, s.id, 100, 'Gunakan butter premium', 'Pending'
FROM products p, staff s 
WHERE p.name = 'Nastar Premium' AND s.name = 'Andi Perkasa'
LIMIT 1;

INSERT INTO tasks (product_id, staff_id, expected_qty, notes, status) 
SELECT p.id, s.id, 50, 'Topping keju parut ekstra', 'Pending'
FROM products p, staff s 
WHERE p.name = 'Kastengel Keju' AND s.name = 'Siti Aminah'
LIMIT 1;
