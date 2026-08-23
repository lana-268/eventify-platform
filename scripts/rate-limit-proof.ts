const baseUrl = process.env.EVENTIFY_BASE_URL ?? "http://localhost:3011";
const email = process.env.EVENTIFY_PROOF_EMAIL;
const password = process.env.EVENTIFY_PROOF_PASSWORD;

if (!email || !password) {
  throw new Error("Set EVENTIFY_PROOF_EMAIL and EVENTIFY_PROOF_PASSWORD to an existing user");
}

const login = await fetch(`${baseUrl}/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Login failed with ${login.status}`);
const { accessToken } = await login.json() as { accessToken: string };

async function bookingAttempt(): Promise<number> {
  const response = await fetch(`${baseUrl}/v1/bookings`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ eventId: "00000000-0000-4000-8000-000000000000" }),
  });
  return response.status;
}

const burst: number[] = [];
for (let request = 1; request <= 11; request += 1) burst.push(await bookingAttempt());
console.log(JSON.stringify({ phase: "burst", statuses: burst }));
if (burst[9] === 429 || burst[10] !== 429) {
  throw new Error(`Expected request 10 to pass and request 11 to return 429; received ${burst.join(",")}`);
}

const windowMs = 10_000;
const waitMs = windowMs - (Date.now() % windowMs) + 100;
await new Promise((resolve) => setTimeout(resolve, waitMs));
const recovered = await bookingAttempt();
console.log(JSON.stringify({ phase: "recovery", waitedMs: waitMs, status: recovered }));
if (recovered === 429) throw new Error("Limiter did not recover after the fixed window");
