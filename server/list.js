import { openWaitlist } from "./db.js";

const signups = await openWaitlist().list();

console.log(`${signups.length} signup${signups.length === 1 ? "" : "s"}`);
for (const signup of signups) {
  console.log(`${signup.createdAt || ""}\t${signup.email}`);
}
