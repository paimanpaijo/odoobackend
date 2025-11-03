// 🧾 Interface utama
export interface SalesSummary {
  id: number;
  no_sales_order: string;
  customer_id: number | null;
  customer_name: string | null;
  sales_exec_id: number | null;
  sales_exec_name: string | null;
  payment_term_id: number | null;
  payment_term_name: string | null;
  total_pembayaran: number;
  hutang: number;
  state: string;
  state_label: string;
  tanggal_order: string;

  // 🔹 Custom field dari res.partner
  agreement: boolean | false;

  // 🔹 Detail item dari sale.order.line
  items: SalesOrderItem[];
}

// 🧩 Interface detail item
export interface SalesOrderItem {
  product_id: number | null;
  product_name: string;
  quantity: number;
  discount: number;
  price_unit: number;
  total_price: number;
  quantity_available: number;
}
