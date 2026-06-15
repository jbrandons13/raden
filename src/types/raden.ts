/**
 * RADEN ERP - Core TypeScript Interfaces
 * Defining strict data structures for maximum stability and 10/10 code quality.
 */

export interface Product {
  id: string;
  name: string;
  category: string;
  initial_stock: number;
  current_stock: number;
  price: number;          // Retail / eceran price (Online & own-store)
  price_agent: number;    // Wholesale price for Agents
  price_branch: number;   // Price for Branches
  unit: string;
  sort_order: number;
  yield_per_batch: number;
  weekly_target: number;
  is_hot_kitchen: boolean;
  tracks_stock: boolean;  // false = fresh / made-to-order (no stock, no target/yield)
  options?: string[];     // optional price-neutral choices, e.g. martabak fillings
  notes?: string;
  image_url?: string;
  created_at?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  created_at?: string;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  qty: number;
  unit: string;
  weekly_target: number;
  notes?: string;
  created_at?: string;
}

export interface MaterialCategory {
  id: string;
  name: string;
  created_at?: string;
}

export interface Staff {
  id: string;
  name: string;
  position: string;
  created_at?: string;
}

export interface StaffShift {
  id: string;
  staff_id: string;
  shift_date: string;
  shift_type: string;
  created_at?: string;
}

export type CustomerType = 'branch' | 'agent';

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;     // Distribution partner type
  address?: string;
  phone?: string;
  total_orders: number;
  total_revenue: number;
  created_at?: string;
}

export interface Order {
  id: string;
  customer_id: string | null;
  customer_name?: string | null;          // for online orders (no saved customer)
  channel?: 'agent' | 'branch' | 'online' | 'eceran' | null;
  order_date: string;
  status: 'Draft' | 'Siap Kirim' | 'Siap Ambil' | 'Selesai';
  total_revenue: number;
  created_at?: string;
  // Joined data
  customers?: Customer;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  qty: number;
  variant?: string | null;   // optional isian/filling for this line (NULL = bebas)
  // Joined data
  products?: Product;
}

export interface ProductionTask {
  id: string;
  date: string;
  product_id: string;
  staff_id: string | null;
  batch_qty: number;
  expected_qty: number;
  actual_qty: number;
  notes?: string;
  status: 'Pending' | 'Completed';
  job_type: 'Pastry' | 'HotKitchen';
  created_at?: string;
  // Joined data
  products?: { name: string; is_hot_kitchen?: boolean };
  staff?: { name: string };
}

export interface ChecklistTemplate {
  id: string;
  task_name: string;
  category: 'Pastry' | 'General' | 'Kitchen';
  is_mandatory_photo: boolean;
  created_at?: string;
}

export interface ChecklistHistory {
  id: string;
  date: string;
  staff_id: string;
  template_id: string;
  is_completed: boolean;
  photo_url?: string;
  created_at?: string;
}

export interface PosSection {
  id: string;
  title: string;
  sort_order: number;
  items?: PosSectionItem[];
}

export interface PosSectionItem {
  id: string;
  section_id: string;
  product_id: string;
  sort_order: number;
  product?: Product;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  receipt_url?: string;
  created_at?: string;
}
