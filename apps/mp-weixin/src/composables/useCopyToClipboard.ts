/**
 * useCopyToClipboard — 跨端复制。
 * 小程序端用 uni.setClipboardData，H5 端用 navigator.clipboard。
 */

import { ref } from "vue";

export interface UseCopyToClipboard {
  state: ReturnType<typeof ref<"idle" | "copied" | "error">>;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

export function useCopyToClipboard(timeoutMs = 1500): UseCopyToClipboard {
  const state = ref<"idle" | "copied" | "error">("idle");

  async function copy(text: string): Promise<boolean> {
    if (!text) {
      state.value = "error";
      setTimeout(() => (state.value = "idle"), timeoutMs);
      return false;
    }
    try {
      // #ifdef MP-WEIXIN
      await new Promise<void>((resolve, reject) => {
        uni.setClipboardData({
          data: text,
          success: () => resolve(),
          fail: (err) => reject(err),
        });
      });
      // #endif
      // #ifdef H5
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      // #endif
      state.value = "copied";
      setTimeout(() => (state.value = "idle"), timeoutMs);
      return true;
    } catch {
      state.value = "error";
      setTimeout(() => (state.value = "idle"), timeoutMs);
      return false;
    }
  }

  function reset() {
    state.value = "idle";
  }

  return { state, copy, reset };
}
