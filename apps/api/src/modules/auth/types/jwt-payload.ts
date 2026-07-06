import { UserRoleType } from '@repo/contracts';

export interface JwtPayload {
  id: number;
  email: string;
  role: UserRoleType;
}
