#!/usr/bin/env node

const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "LOADTEST_EMAILS",
  "LOADTEST_PASSWORD",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

const baseUrl =
  process.env.SUPABASE_URL.replace(/\/+$/, "");
const anonKey =
  process.env.SUPABASE_ANON_KEY;
const emails =
  process.env.LOADTEST_EMAILS
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
const password =
  process.env.LOADTEST_PASSWORD;

const vus =
  Math.max(
    1,
    Number(process.env.VUS || emails.length || 1)
  );
const durationMs =
  Math.max(
    10,
    Number(process.env.DURATION_SECONDS || 60)
  ) * 1000;
const thinkMs =
  Math.max(
    250,
    Number(process.env.THINK_MS || 5000)
  );

const samples = [];
let totalRequests = 0;
let failedRequests = 0;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1
  );
  return sorted[Math.max(0, index)];
};

async function request(path, token, options = {}) {
  const started = performance.now();
  totalRequests += 1;

  const response = await fetch(
    `${baseUrl}${path}`,
    {
      ...options,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );

  const elapsed =
    performance.now() - started;

  samples.push(elapsed);

  if (!response.ok) {
    failedRequests += 1;
    const body = await response.text();
    throw new Error(
      `${response.status} ${path}: ${body.slice(0, 300)}`
    );
  }

  await response.text();
  return elapsed;
}

async function signIn(email) {
  const response = await fetch(
    `${baseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Login failed for ${email}: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();
  return data.access_token;
}

async function activityReadCycle(token) {
  await request(
    "/rest/v1/activities?select=*&order=due_date.asc.nullslast,created_at.desc&limit=5000",
    token
  );

  await Promise.all([
    request(
      "/rest/v1/rpc/get_my_activity_action_roles",
      token,
      {
        method: "POST",
        body: "{}",
      }
    ),
    request(
      "/rest/v1/rpc/get_my_activity_attention_v2",
      token,
      {
        method: "POST",
        body: "{}",
      }
    ),
    request(
      "/rest/v1/rpc/get_my_activity_discussion_attention_v3",
      token,
      {
        method: "POST",
        body: "{}",
      }
    ),
  ]);

  await request(
    "/rest/v1/notifications?select=id,read_at,created_at&order=created_at.desc&limit=30",
    token
  );
}

async function virtualUser(id, token, deadline) {
  let cycles = 0;

  while (Date.now() < deadline) {
    try {
      await activityReadCycle(token);
      cycles += 1;
    } catch (error) {
      console.error(`[VU ${id}] ${error.message}`);
    }

    const jitter =
      Math.floor(
        Math.random() *
          Math.min(1000, thinkMs / 4)
      );

    await sleep(thinkMs + jitter);
  }

  return cycles;
}

console.log(
  `Signing in ${emails.length} load-test account(s)...`
);

const tokens = [];
for (const email of emails) {
  tokens.push(await signIn(email));
}

console.log(
  `Starting read-only load test: ${vus} VUs, ${durationMs / 1000}s, think=${thinkMs}ms`
);

const deadline =
  Date.now() + durationMs;

const cycleCounts = await Promise.all(
  Array.from({ length: vus }, (_, index) =>
    virtualUser(
      index + 1,
      tokens[index % tokens.length],
      deadline
    )
  )
);

const errorRate =
  totalRequests
    ? (failedRequests / totalRequests) * 100
    : 0;

const p50 = percentile(samples, 50);
const p95 = percentile(samples, 95);
const p99 = percentile(samples, 99);

console.log("\n=== LOAD TEST RESULT ===");
console.log(`Virtual users : ${vus}`);
console.log(
  `Cycles        : ${cycleCounts.reduce((a, b) => a + b, 0)}`
);
console.log(`Requests      : ${totalRequests}`);
console.log(`Failed        : ${failedRequests}`);
console.log(`Error rate    : ${errorRate.toFixed(2)}%`);
console.log(`Latency p50   : ${p50.toFixed(0)} ms`);
console.log(`Latency p95   : ${p95.toFixed(0)} ms`);
console.log(`Latency p99   : ${p99.toFixed(0)} ms`);

const passed =
  errorRate < 1 &&
  p95 < 800;

console.log(
  passed
    ? "\nPASS: baseline target tercapai."
    : "\nATTENTION: baseline target belum tercapai."
);

process.exitCode =
  passed ? 0 : 2;
