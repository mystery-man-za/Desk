export const ROLES = ['System Manager', 'Books Manager', 'Books User'] as const;
export type Role = (typeof ROLES)[number];

export type AuthenticatedUser = {
  id: number;
  email: string;
  fullname: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionTokenHash?: string;
    }
  }
}
