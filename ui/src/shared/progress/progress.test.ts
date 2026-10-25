import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginTask,
  endTask,
  fail,
  finish,
  progressBarState,
  reset,
  set,
  start,
} from "./index";

describe("progress bar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reset();
  });

  afterEach(() => {
    reset();
    vi.useRealTimers();
  });

  it("starts in idle hidden state", () => {
    expect(progressBarState.visible).toBe(false);
    expect(progressBarState.progress).toBe(0);
    expect(progressBarState.status).toBe("idle");
  });

  it("activates and trickles progress on start", () => {
    start();
    expect(progressBarState.visible).toBe(true);
    expect(progressBarState.status).toBe("running");
    expect(progressBarState.progress).toBeGreaterThanOrEqual(16);

    const initial = progressBarState.progress;
    vi.advanceTimersByTime(200);
    expect(progressBarState.progress).toBeGreaterThan(initial);
  });

  it("allows setting explicit progress", () => {
    set(42);
    expect(progressBarState.visible).toBe(true);
    expect(progressBarState.progress).toBe(42);
  });

  it("finishes with 100% and resets after animation delay", () => {
    start();
    finish();
    expect(progressBarState.status).toBe("finishing");
    expect(progressBarState.progress).toBe(100);

    vi.advanceTimersByTime(500);
    expect(progressBarState.visible).toBe(false);
    expect(progressBarState.status).toBe("idle");
    expect(progressBarState.progress).toBe(0);
  });

  it("handles failure status", () => {
    start();
    fail();
    expect(progressBarState.status).toBe("error");
    expect(progressBarState.progress).toBe(100);

    vi.advanceTimersByTime(650);
    expect(progressBarState.visible).toBe(false);
    expect(progressBarState.status).toBe("idle");
  });

  it("coordinates concurrent tasks with reference counting", () => {
    beginTask(); // task 1
    expect(progressBarState.visible).toBe(true);
    expect(progressBarState.status).toBe("running");

    beginTask(); // task 2
    expect(progressBarState.status).toBe("running");

    endTask(); // task 2 finishes, task 1 still running
    expect(progressBarState.status).toBe("running");
    expect(progressBarState.visible).toBe(true);

    endTask(); // task 1 finishes, all tasks done
    expect(progressBarState.status).toBe("finishing");
    expect(progressBarState.progress).toBe(100);

    vi.advanceTimersByTime(500);
    expect(progressBarState.visible).toBe(false);
  });
});
