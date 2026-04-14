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
  price: number;
  unit: string;
  sort_order: number;
  yield_per_batch: number;
  weekly_target: number;
  is_hot_kitchen: boolean;
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

export interface Customer {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  total_orders: number;
  total_revenue: number;
  created_at?: string;
}

export interface Order {
  id: string;
  customer_id: string;
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
