/**
 * useCancelable — 维护一个 AbortController。
 * - `run(fn)` 把异步操作绑到当前 signal；下一次 run 或 cancel 自动 abort 上一次
 * - `cancel(reason?)` 主动取消
 * - 组件卸载时自动 cancel
 *
 * 适用于：转换、执行、下载等「点运行 → 等待 → 可取消」模式。
 */

import { onBeforeUnmount, ref } from "vue";

export interface CancelableHandle {
  /** 触发一次新操作；自动 abort 旧 controller */
  run<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T>;
  /** 主动取消当前操作 */
  cancel(reason?: string): void;
  /** 当前是否在运行中 */
  readonly running: ReturnType<typeof ref<boolean>>;
  /** 暴露给子组件的 signal */
  readonly signal: ReturnType<typeof ref<AbortSignal | null>>;
}

export function useCancelable(): CancelableHandle {
  const ctrl = ref<AbortController | null>(null);
  const signal = ref<AbortSignal | null>(null);
  const running = ref(false);

  function cancel(reason?: string): void {
    if (ctrl.value && !ctrl.value.signal.aborted) {
      ctrl.value.abort(reason ?? "cancelled");
    }
  }

  async function run<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    cancel("superseded");
    const c = new AbortController();
    ctrl.value = c;
    signal.value = c.signal;
    running.value = true;
    try {
      return await fn(c.signal);
    } finally {
      // 仅在当前仍是自己的 controller 时清理
      if (ctrl.value === c) {
        ctrl.value = null;
        signal.value = null;
      }
      running.value = false;
    }
  }

  onBeforeUnmount(() => cancel("unmounted"));

  return { run, cancel, running, signal };
}
