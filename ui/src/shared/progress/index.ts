import { reactive } from "vue";

export type ProgressStatus = "idle" | "running" | "finishing" | "error";

export interface ProgressBarState {
  visible: boolean;
  progress: number;
  status: ProgressStatus;
}

export const progressBarState = reactive<ProgressBarState>({
  visible: false,
  progress: 0,
  status: "idle",
});

let timer: ReturnType<typeof setInterval> | null = null;
let finishTimeout: ReturnType<typeof setTimeout> | null = null;
let activeTasks = 0;

function clearTimers(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (finishTimeout !== null) {
    clearTimeout(finishTimeout);
    finishTimeout = null;
  }
}

function trickle(): void {
  if (progressBarState.status !== "running") return;
  const current = progressBarState.progress;
  let delta = 0;
  if (current < 25) {
    delta = Math.random() * 8 + 5; // +5-13%
  } else if (current < 55) {
    delta = Math.random() * 5 + 2.5; // +2.5-7.5%
  } else if (current < 75) {
    delta = Math.random() * 3 + 1; // +1-4%
  } else if (current < 90) {
    delta = Math.random() * 1.5 + 0.5; // +0.5-2%
  } else if (current < 98) {
    delta = 0.2;
  }
  progressBarState.progress = Math.min(98, current + delta);
}

export function start(): void {
  clearTimers();
  progressBarState.status = "running";
  progressBarState.visible = true;
  progressBarState.progress = Math.max(progressBarState.progress, 16);
  timer = setInterval(trickle, 180);
}

export function set(value: number): void {
  progressBarState.visible = true;
  progressBarState.progress = Math.min(100, Math.max(0, value));
}

export function finish(): void {
  if (!progressBarState.visible || progressBarState.status === "finishing") return;
  clearTimers();
  progressBarState.status = "finishing";
  progressBarState.progress = 100;

  finishTimeout = setTimeout(() => {
    progressBarState.visible = false;
    progressBarState.status = "idle";
    progressBarState.progress = 0;
    finishTimeout = null;
  }, 450);
}

export function fail(): void {
  clearTimers();
  progressBarState.visible = true;
  progressBarState.status = "error";
  progressBarState.progress = 100;

  finishTimeout = setTimeout(() => {
    progressBarState.visible = false;
    progressBarState.status = "idle";
    progressBarState.progress = 0;
    finishTimeout = null;
  }, 600);
}

export function beginTask(): void {
  activeTasks++;
  if (activeTasks === 1) {
    start();
  }
}

export function endTask(): void {
  activeTasks = Math.max(0, activeTasks - 1);
  if (activeTasks === 0) {
    finish();
  }
}

export function reset(): void {
  clearTimers();
  activeTasks = 0;
  progressBarState.visible = false;
  progressBarState.progress = 0;
  progressBarState.status = "idle";
}

export const progressBar = {
  state: progressBarState,
  start,
  set,
  finish,
  fail,
  beginTask,
  endTask,
  reset,
};
