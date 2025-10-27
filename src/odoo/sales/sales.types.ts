
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
}

