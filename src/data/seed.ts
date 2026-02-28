import type { Category, Entry } from "../models/types";

export const seedCategories: Category[] = [
  // Puedes crear subcategorías usando `parentId`
  { id: "uni", name: "Uni" },
  { id: "udc", name: "UDC", parentId: "uni" },
  { id: "biblio", name: "Biblioteca", parentId: "uni" },

  { id: "trabajo", name: "Trabajo" },
  { id: "dev", name: "Dev", parentId: "trabajo" },
  { id: "infra", name: "Infra", parentId: "trabajo" },

  { id: "juegos", name: "Juegos" },
  { id: "juegos_pc", name: "PC", parentId: "juegos" },
  { id: "juegos_consola", name: "Consola", parentId: "juegos" },
];

export const seedEntries: Entry[] = [
  // UNI
  {
    id: "u1",
    categoryId: "udc",
    name: "Campus UDC",
    username: "usuario@udc.es",
    password: "********",
    notes: "Cambiar cada 6 meses",
    updatedAt: Date.now(),
  },
  {
    id: "u2",
    categoryId: "udc",
    name: "Moodle",
    username: "usuario@udc.es",
    password: "********",
    updatedAt: Date.now(),
  },
  {
    id: "u3",
    categoryId: "udc",
    name: "Correo UDC",
    username: "usuario@udc.es",
    password: "********",
    updatedAt: Date.now(),
  },

  // TRABAJO
  {
    id: "t1",
    categoryId: "dev",
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
    categoryId: "dev",
    name: "Notion",
    username: "nercy@mail.com",
    password: "********",
    url: "https://notion.so",
    updatedAt: Date.now(),
  },

  // JUEGOS
  {
    id: "j1",
    categoryId: "juegos_pc",
    name: "Riot",
    username: "mainGwen",
    password: "********",
    updatedAt: Date.now(),
  },
  {
    id: "j2",
    categoryId: "juegos_pc",
    name: "Steam",
    username: "nercy_steam",
    password: "********",
    updatedAt: Date.now(),
  },
  {
    id: "j3",
    categoryId: "juegos_pc",
    name: "Epic Games",
    username: "nercy_epic",
    password: "********",
    updatedAt: Date.now(),
  },
];