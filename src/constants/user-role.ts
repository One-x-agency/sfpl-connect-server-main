export const STAFF_ROLES = [
  'admin',
  'qc',
  'support',
  'accountant',
  'warehouse',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}
