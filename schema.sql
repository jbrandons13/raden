-- Enable RLS
-- (Note: For MVP with a fixed 4-digit PIN, we can keep it simple, but schema should be robust)

-- Customers Table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table (Barang Jadi)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  initial_stock INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Materials Table (Bahan Baku)
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT, -- For custom tabs
  qty NUMERIC DEFAULT 0,
  unit TEXT,
  notes TEXT, -- For purchase recommendations
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff Table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  position TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules Table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff(id),
  date DATE NOT NULL,
  shift_code TEXT, -- EM, EMS, M, A, AS
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  order_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Draft', -- Draft, Siap Kirim/Ambil, Selesai
  total_revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  qty INTEGER NOT NULL
);

-- Production Tasks (Jobdesk Harian)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE DEFAULT CURRENT_DATE,
  product_id UUID REFERENCES products(id),
  staff_id UUID REFERENCES staff(id),
  expected_qty INTEGER,
  actual_qty INTEGER,
  notes TEXT,
  status TEXT DEFAULT 'Pending', -- Pending, Completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Checklists Definitions
CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_name TEXT NOT NULL,
  category TEXT, -- Pastry, General, Kitchen
  is_mandatory_photo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Checklist History
CREATE TABLE checklist_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE DEFAULT CURRENT_DATE,
  staff_id UUID REFERENCES staff(id),
  template_id UUID REFERENCES checklist_templates(id),
  is_completed BOOLEAN DEFAULT FALSE,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Check History (Raw Materials)
CREATE TABLE stock_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE DEFAULT CURRENT_DATE,
  staff_name TEXT, -- Added as per user request
  material_id UUID REFERENCES materials(id),
  actual_qty NUMERIC,
  how_much_to_buy TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Production Estimate Master Data
CREATE TABLE production_estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  batch_name TEXT,
  target_yield INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Change Logs
CREATE TABLE stock_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_type TEXT, -- Product, Material
  item_id UUID,
  change_qty NUMERIC,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
