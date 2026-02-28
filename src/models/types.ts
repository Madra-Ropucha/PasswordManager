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