export const ROLES = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Pemilik Toko',
  MANAGER: 'Manajer Toko',
  CASHIER: 'Kasir',
};

export const PERMISSIONS = {
  MANAGE_SETTINGS: [ROLES.OWNER],
  MANAGE_USERS: [ROLES.OWNER, ROLES.MANAGER],
  MANAGE_PRODUCTS: [ROLES.OWNER, ROLES.MANAGER],
  MANAGE_STOCK: [ROLES.OWNER, ROLES.MANAGER],
  VIEW_REPORTS: [ROLES.OWNER, ROLES.MANAGER],
  ACCESS_POS: [ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER],
};

export const ROLE_ACCESS = {
  [ROLES.OWNER]: ['/dashboard', '/pos', '/customers', '/products', '/suppliers', '/low-stock', '/reports', '/users', '/settings'],
  [ROLES.MANAGER]: ['/dashboard', '/pos', '/customers', '/products', '/suppliers', '/low-stock', '/reports', '/users', '/settings'],
  [ROLES.CASHIER]: ['/dashboard', '/pos', '/customers'],
};
