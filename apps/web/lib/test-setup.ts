import { AsyncLocalStorage } from "node:async_hooks";
(globalThis as any).AsyncLocalStorage = AsyncLocalStorage;

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "test_secret_for_unit_tests_32_characters_long";
}
