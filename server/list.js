import { openWaitlist } from "./db.js";

const { client, waitlist } = await openWaitlist();
const signups = await waitlist.find({}, { projection: { _id: 0, email: 1, createdAt: 1 } }).sort({ createdAt: 1 }).toArray();

console.log(`${signups.length} signup${signups.length === 1 ? "" : "s"}`);
for (const signup of signups) {
  const when = signup.createdAt ? signup.createdAt.toISOString() : "";
  console.log(`${when}\t${signup.email}`);
}

await client.close();
