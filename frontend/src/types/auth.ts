export interface AuthUser {
  id: number;
  email: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSuccessPayload {
  user: AuthUser;
  token: string;
}
