import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

type PushOutboxRow = {
  id: number;
  recipient_profile_id: string;
  source: string;
  source_id: string;
  notification_type: string | null;
  module: string | null;
  title: string;
  message: string;
  link_path: string | null;
  status: string;
  attempts: number;
  created_at: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

const json = (
  payload: unknown,
  status = 200
) =>
  new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=utf-8",
      },
    }
  );

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      405
    );
  }

  const expectedDispatchKey =
    Deno.env.get(
      "PUSH_DISPATCH_KEY"
    ) || "";

  const actualDispatchKey =
    request.headers.get(
      "x-push-dispatch-key"
    ) || "";

  if (
    !expectedDispatchKey ||
    actualDispatchKey !==
      expectedDispatchKey
  ) {
    return json(
      { error: "Unauthorized" },
      401
    );
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    ) || "";
  const vapidPublicKey =
    Deno.env.get(
      "VAPID_PUBLIC_KEY"
    ) || "";
  const vapidPrivateKey =
    Deno.env.get(
      "VAPID_PRIVATE_KEY"
    ) || "";
  const vapidSubject =
    Deno.env.get(
      "VAPID_SUBJECT"
    ) ||
    "mailto:dashboard-marketing@pertalife.com";

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    return json(
      {
        error:
          "Push dispatch secret belum lengkap.",
      },
      500
    );
  }

  let body:
    | {
        outboxId?: number;
      }
    | undefined;

  try {
    body =
      await request.json();
  } catch {
    return json(
      { error: "JSON body tidak valid." },
      400
    );
  }

  const outboxId =
    Number(body?.outboxId);

  if (
    !Number.isFinite(outboxId) ||
    outboxId <= 0
  ) {
    return json(
      {
        error:
          "outboxId wajib berupa angka valid.",
      },
      400
    );
  }

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  const {
    data: outbox,
    error: outboxError,
  } =
    await supabase
      .from("push_outbox_v13")
      .select(
        "id, recipient_profile_id, source, source_id, notification_type, module, title, message, link_path, status, attempts, created_at"
      )
      .eq("id", outboxId)
      .maybeSingle<PushOutboxRow>();

  if (
    outboxError ||
    !outbox
  ) {
    return json(
      {
        error:
          outboxError?.message ||
          "Push outbox tidak ditemukan.",
      },
      404
    );
  }

  if (
    outbox.status === "SENT" ||
    outbox.status ===
      "NO_SUBSCRIPTION"
  ) {
    return json({
      ok: true,
      skipped: true,
      status: outbox.status,
    });
  }

  const attempt =
    Number(outbox.attempts || 0) +
    1;

  await supabase
    .from("push_outbox_v13")
    .update({
      status: "PROCESSING",
      attempts: attempt,
      last_error: null,
    })
    .eq("id", outbox.id);

  const {
    data: subscriptions,
    error: subscriptionError,
  } =
    await supabase
      .from("push_subscriptions_v13")
      .select(
        "id, endpoint, p256dh, auth_key"
      )
      .eq(
        "profile_id",
        outbox.recipient_profile_id
      )
      .eq("enabled", true);

  if (subscriptionError) {
    await supabase
      .from("push_outbox_v13")
      .update({
        status: "FAILED",
        last_error:
          subscriptionError.message,
      })
      .eq("id", outbox.id);

    return json(
      {
        error:
          subscriptionError.message,
      },
      500
    );
  }

  const activeSubscriptions =
    (subscriptions ||
      []) as PushSubscriptionRow[];

  if (
    activeSubscriptions.length === 0
  ) {
    await supabase
      .from("push_outbox_v13")
      .update({
        status:
          "NO_SUBSCRIPTION",
        last_error: null,
      })
      .eq("id", outbox.id);

    return json({
      ok: true,
      status:
        "NO_SUBSCRIPTION",
    });
  }

  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );

  const payload =
    JSON.stringify({
      title: outbox.title,
      message: outbox.message,
      linkPath:
        outbox.link_path ||
        "/aktivitas",
      module: outbox.module,
      notificationType:
        outbox.notification_type,
      tag:
        `${outbox.source}:${outbox.source_id}`,
      createdAt:
        outbox.created_at,
    });

  let sent = 0;
  const errors: string[] = [];

  for (
    const subscription
    of activeSubscriptions
  ) {
    try {
      await webpush.sendNotification(
        {
          endpoint:
            subscription.endpoint,
          keys: {
            p256dh:
              subscription.p256dh,
            auth:
              subscription.auth_key,
          },
        },
        payload,
        {
          TTL: 60 * 60,
          urgency: "high",
        }
      );

      sent += 1;
    } catch (error) {
      const statusCode =
        Number(
          (
            error as {
              statusCode?: number;
            }
          )?.statusCode || 0
        );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      errors.push(
        `${statusCode || "ERR"}: ${message}`
      );

      if (
        statusCode === 404 ||
        statusCode === 410
      ) {
        await supabase
          .from(
            "push_subscriptions_v13"
          )
          .update({
            enabled: false,
            disabled_at:
              new Date().toISOString(),
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            subscription.id
          );
      }
    }
  }

  if (sent > 0) {
    await supabase
      .from("push_outbox_v13")
      .update({
        status: "SENT",
        sent_at:
          new Date().toISOString(),
        last_error:
          errors.length > 0
            ? errors
                .join(" | ")
                .slice(0, 2000)
            : null,
      })
      .eq("id", outbox.id);

    return json({
      ok: true,
      status: "SENT",
      sent,
      failed:
        errors.length,
    });
  }

  await supabase
    .from("push_outbox_v13")
    .update({
      status: "FAILED",
      last_error:
        errors
          .join(" | ")
          .slice(0, 2000) ||
        "Tidak ada push yang berhasil dikirim.",
    })
    .eq("id", outbox.id);

  return json(
    {
      ok: false,
      status: "FAILED",
      sent: 0,
      failed:
        errors.length,
    },
    502
  );
});
