// Sample sandbox data. Edit these lists to match the accounts and products
// your trainees will see in the real system.
window.SEED_DATA = {
  accounts: [
    { id: 'acc1', name: 'Acme Manufacturing', number: 'A-10021', industry: 'Manufacturing', phone: '(555) 201-3344', owner: 'Training Team',
      billing: '100 Industrial Way, Springfield, IL 62701', shipping: '100 Industrial Way, Springfield, IL 62701', status: 'Active' },
    { id: 'acc2', name: 'Blue Harbor Logistics', number: 'A-10022', industry: 'Transportation', phone: '(555) 410-7781', owner: 'Training Team',
      billing: '45 Dockside Ave, Portland, ME 04101', shipping: 'Warehouse 7, 12 Pier Rd, Portland, ME 04102', status: 'Active' },
    { id: 'acc3', name: 'Summit Health Partners', number: 'A-10023', industry: 'Healthcare', phone: '(555) 778-0090', owner: 'Training Team',
      billing: '900 Summit Blvd, Denver, CO 80202', shipping: '900 Summit Blvd, Denver, CO 80202', status: 'Active' },
    { id: 'acc4', name: 'Greenleaf Retail Group', number: 'A-10024', industry: 'Retail', phone: '(555) 332-1200', owner: 'Training Team',
      billing: '18 Market St, Austin, TX 78701', shipping: '', status: 'Active' },
    { id: 'acc5', name: 'Northwind Traders', number: 'A-10025', industry: 'Wholesale', phone: '(555) 650-4410', owner: 'Training Team',
      billing: '7 Harbor View, Seattle, WA 98101', shipping: '7 Harbor View, Seattle, WA 98101', status: 'On Hold' }
  ],
  products: [
    { id: 'p1', code: 'HW-LAP-01', name: 'Business Laptop 14"', family: 'Hardware', price: 1199.00, active: true },
    { id: 'p2', code: 'HW-MON-27', name: '27" 4K Monitor', family: 'Hardware', price: 349.00, active: true },
    { id: 'p3', code: 'HW-DCK-02', name: 'USB-C Docking Station', family: 'Hardware', price: 189.00, active: true },
    { id: 'p4', code: 'SW-OFF-YR', name: 'Office Suite License (1 yr)', family: 'Software', price: 99.00, active: true },
    { id: 'p5', code: 'SW-SEC-YR', name: 'Endpoint Security (1 yr)', family: 'Software', price: 45.00, active: true },
    { id: 'p6', code: 'SV-INS-HR', name: 'On-site Installation (per hour)', family: 'Services', price: 120.00, active: true },
    { id: 'p7', code: 'SV-SUP-PR', name: 'Premium Support Plan (1 yr)', family: 'Services', price: 499.00, active: true },
    { id: 'p8', code: 'HW-PRN-OLD', name: 'Legacy Laser Printer', family: 'Hardware', price: 260.00, active: false }
  ],
  // Orders above this amount need manager approval after submission.
  approvalThreshold: 10000,
  // Max line discount a rep may apply without approval (percent).
  maxDiscount: 20
};
