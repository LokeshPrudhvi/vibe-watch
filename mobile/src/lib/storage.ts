import { createMMKV } from "react-native-mmkv";
import { createJSONStorage, type StateStorage } from "zustand/middleware";

/** MMKV: synchronous, memory-mapped storage. Much faster than AsyncStorage for the taste log. */
export const mmkv = createMMKV({ id: "vibe" });

const mmkvStorage: StateStorage = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    mmkv.remove(key);
  },
};

/** Storage for Zustand's `persist` middleware. */
export const persistStorage = createJSONStorage(() => mmkvStorage);
