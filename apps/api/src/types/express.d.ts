import { JwtPayload } from '../modules/auth/types/jwt-payload.js';

declare global {
  namespace Express {
    interface User extends JwtPayload {}
  }
}

export {};
