/**
 * useRecentTools — 最近使用工具持久化。
 * 跨端：小程序用 uni.storage，H5 用 localStorage。
 * 通过 @docforge/storage mpAdapter 统一。
 */

import { ref, onMounted } from "vue";
import { mpAdapter, type KvStore } from "@docforge/storage";

const KEY = "recent-tools";
const MAX = 8;

let store: KvStore | null = null;
async function getStore(): Promise<KvStore> {
  if (!store) store = await mpAdapter.open();
  return store;
}

export function useRecentTools() {
  const list = ref<string[]>([]);

  async function load() {
    const s = await getStore();
    list.value = (await s.get<string[]>(KEY)) ?? [];
  }

  async function add(slug: string) {
    await load();
    const next = [slug, ...list.value.filter((s) => s !== slug)].slice(0, MAX);
    list.value = next;
    const s = await getStore();
    await s.set(KEY, next);
  }

  async function clear() {
    list.value = [];
    const s = await getStore();
    await s.set(KEY, []);
  }

  onMounted(() => {
    void load();
  });

  return { list, add, clear, load };
}
