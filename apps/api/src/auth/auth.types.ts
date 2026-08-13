import type { Role } from '@pisma/domain';

export type AuthUser = {
  userId: string;
  username: string;
  workId: string | null;
  role: Role | null;
  sessionId: string;
  fullName: string;
  firstLoginCompleted: boolean;
};

export type RequestWithUser = {
  user: AuthUser;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};
