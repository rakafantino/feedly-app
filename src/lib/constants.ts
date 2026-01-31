export const ROLES = {
  OWNER: 'OWNER',
  CASHIER: 'CASHIER',
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Pemilik Toko',
  CASHIER: 'Kasir',
};

export const PERMISSIONS = {
  MANAGE_SETTINGS: [ROLES.OWNER],
  MANAGE_USERS: [ROLES.OWNER],
  MANAGE_PRODUCTS: [ROLES.OWNER],
  MANAGE_STOCK: [ROLES.OWNER],
  VIEW_REPORTS: [ROLES.OWNER],
  ACCESS_POS: [ROLES.OWNER, ROLES.CASHIER],
};

export const ROLE_ACCESS = {
  [ROLES.OWNER]: ['/dashboard', '/pos', '/customers', '/products', '/suppliers', '/inventory', '/expenses', '/reports', '/users', '/settings'],
  [ROLES.CASHIER]: ['/dashboard', '/pos'],
};
