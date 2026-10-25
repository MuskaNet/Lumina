import { ref } from "vue";

export type SnackbarTone = "info" | "ok" | "error";

export interface SnackbarMessage {
  id: number;
  text: string;
  tone: SnackbarTone;
}

let nextId = 1;

export const snackbar = ref<SnackbarMessage | null>(null);

export function showToast(text: string, tone: SnackbarTone = "info"): void {
  snackbar.value = { id: nextId++, text, tone };
}

export function dismissToast(): void {
  snackbar.value = null;
}
