export interface RefreshTokenPayload {
  id: number;
  sessionId: string;
  type: 'refresh';
}
