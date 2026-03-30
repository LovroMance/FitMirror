export interface JwtPayload {
  sub: string;
  email: string;
}

export interface SafeUser {
  id: number;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}
