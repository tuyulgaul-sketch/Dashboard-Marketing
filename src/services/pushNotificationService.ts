import { supabase } from "@/lib/supabase";

export type PushNotificationState =
  | "UNSUPPORTED"
  | "DENIED"
  | "AVAILABLE"
  | "ENABLED";

const urlBase64ToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = window.atob(base64);
  return Uint8Array.from(
    [...raw].map((character) => character.charCodeAt(0))
  );
};

export const isPushNotificationSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const getRegistration = async () => {
  if (!isPushNotificationSupported()) {
    throw new Error("Push notification tidak didukung di perangkat/browser ini.");
  }

  return navigator.serviceWorker.ready;
};

const getVapidPublicKey = async () => {
  const { data, error } = await supabase.rpc(
    "get_push_vapid_public_key_v13"
  );

  if (error) {
    throw error;
  }

  const key = String(data || "").trim();

  if (!key) {
    throw new Error(
      "Push notification belum dikonfigurasi oleh administrator."
    );
  }

  return key;
};

const registerSubscription = async (
  subscription: PushSubscription
) => {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh || "";
  const auth = json.keys?.auth || "";

  if (!p256dh || !auth) {
    throw new Error("Push subscription key tidak lengkap.");
  }

  const { error } = await supabase.rpc(
    "register_push_subscription_v13",
    {
      p_endpoint: subscription.endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: navigator.userAgent,
    }
  );

  if (error) {
    throw error;
  }
};

export const getPushNotificationState =
  async (): Promise<PushNotificationState> => {
    if (!isPushNotificationSupported()) {
      return "UNSUPPORTED";
    }

    if (Notification.permission === "denied") {
      return "DENIED";
    }

    const registration = await getRegistration();
    const subscription =
      await registration.pushManager.getSubscription();

    if (
      Notification.permission === "granted" &&
      subscription
    ) {
      return "ENABLED";
    }

    return "AVAILABLE";
  };

export const syncExistingPushSubscription =
  async () => {
    if (
      !isPushNotificationSupported() ||
      Notification.permission !== "granted"
    ) {
      return false;
    }

    const registration = await getRegistration();
    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return false;
    }

    await registerSubscription(subscription);
    return true;
  };

export const enablePushNotifications =
  async () => {
    if (!isPushNotificationSupported()) {
      throw new Error(
        "Push notification tidak didukung di perangkat/browser ini."
      );
    }

    const permission =
      await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error(
        permission === "denied"
          ? "Izin notifikasi diblokir. Aktifkan kembali dari pengaturan browser/HP."
          : "Izin notifikasi belum diberikan."
      );
    }

    const registration = await getRegistration();
    let subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      const vapidPublicKey = await getVapidPublicKey();

      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(vapidPublicKey),
        });
    }

    try {
      await registerSubscription(subscription);
    } catch (error) {
      await subscription.unsubscribe().catch(
        () => undefined
      );
      throw error;
    }

    return subscription;
  };

export const disablePushNotifications =
  async () => {
    if (!isPushNotificationSupported()) {
      return;
    }

    const registration = await getRegistration();
    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return;
    }

    const { error } = await supabase.rpc(
      "disable_push_subscription_v13",
      {
        p_endpoint: subscription.endpoint,
      }
    );

    if (error) {
      throw error;
    }

    await subscription.unsubscribe();
  };
