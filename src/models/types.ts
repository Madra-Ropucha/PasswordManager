export type Category = {
  id: string;
  name: string;
  parentId?: string;
  deletedAt?: number;
};

export type Entry = {
  id: string;
  categoryId: string;
  name: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  favorite?: boolean;
  updatedAt: number;
  deletedAt?: number;
};

export type User = {
  id: string;
  username: string;
  /** Demo local: por simplicidad se guarda en claro (NO es seguro). */
  password: string;
  createdAt: number;
};