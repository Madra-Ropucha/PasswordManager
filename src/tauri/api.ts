import { invoke } from "@tauri-apps/api/core";

/**
 * Wrapper para invocar comandos Tauri.
 * - `invoke` es la fuente de verdad: si estamos en Tauri funciona; si no, lanza error.
 */
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);

    // Mensaje amable si se está ejecutando en navegador (vite dev / preview).
    if (msg.includes("__TAURI_INTERNALS__") || msg.toLowerCase().includes("ipc") || msg.toLowerCase().includes("tauri")) {
      throw new Error("Esta pantalla requiere ejecutarse dentro de Tauri (tauri dev / build)");
    }

    // Para otros errores reales (comando no registrado, etc.), mostramos el mensaje tal cual.
    throw new Error(msg);
  }
}