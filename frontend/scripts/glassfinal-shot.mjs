// Throwaway admin in data-rich church 33 for final Step-1+2 confirmation screenshots.
// `node scripts/glassfinal-shot.mjs` / `... teardown`. Net-zero.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(here, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !env[m[1]]) env[m[1]] = m[2].trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const EMAIL = "qa-glassfinal@shepherd-test.dev";
const PASSWORD = "ShepherdQA!2026";
const CHURCH = 33;

async function findUser() {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === EMAIL);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

if (process.argv[2] === "teardown") {
  const u = await findUser();
  if (u) {
    await admin.from("church_users").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
  console.log("teardown: done");
  process.exit(0);
}

let user = await findUser();
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  user = data.user;
} else {
  await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true });
}
await admin.from("church_users").delete().eq("user_id", user.id);
const cu = await admin.from("church_users").insert({ user_id: user.id, church_id: CHURCH, role: "admin" });
if (cu.error) throw cu.error;
console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, church: CHURCH }, null, 2));
