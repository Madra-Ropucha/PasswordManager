import type { Category, Entry } from "../models/types";

export const seedCategories: Category[] = [
  { id: "uni", name: "Uni" },
  { id: "trabajo", name: "Trabajo" },
  { id: "juegos", name: "Juegos" },
];

export const seedEntries: Entry[] = [
  // UNI
  {
    id: "u1",
    categoryId: "uni",
    name: "Campus UDC",
    username: "usuario@udc.es",
    password: "********",
    notes: "Cambiar cada 6 meses",
    updatedAt: Date.now(),
  },
  {
    id: "u2",
    categoryId: "uni",
    name: "Moodle",
    username: "usuario@udc.es",
    password: "********",
    updatedAt: Date.now(),
  },
  {
    id: "u3",
    categoryId: "uni",
    name: "Correo UDC",
    username: "usuario@udc.es",
    password: "********",
    updatedAt: Date.now(),
  },

  // TRABAJO
  {
    id: "t1",
    categoryId: "trabajo",
    name: "GitHub",
    username: "Nercy",
    password: "********",
    notes: "2FA activado",
    url: "https://github.com",
    favorite: true,
    updatedAt: Date.now(),
  },
  {
    id: "t2",
    categoryId: "trabajo",
    name: "Notion",
    username: "nercy@mail.com",
    password: "********",
    url: "https://notion.so",
    updatedAt: Date.now(),
  },

  // JUEGOS
  {
    id: "j1",
    categoryId: "juegos",
    name: "Riot",
    username: "mainGwen",
    password: "********",
    updatedAt: Date.now(),
  },
  {
    id: "j2",
    categoryId: "juegos",
    name: "Steam",
    username: "nercy_steam",
    password: "********",
    updatedAt: Date.now(),
  },
  {
    id: "j3",
    categoryId: "juegos",
    name: "Epic Games",
    username: "nercy_epic",
    password: "********",
    updatedAt: Date.now(),
  },
];