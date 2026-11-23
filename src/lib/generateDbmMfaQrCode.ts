import { qrcodegen } from "@/lib/vendor/qrcodegen";

/**
 * Encode the Supabase-provided TOTP enrollment URI locally.
 * Never send the otpauth URI or shared secret to a QR code web service.
 *
 * The issuer is DBM; the authenticator account label is DBM_<email>.
 * The secret, algorithm, digits, and period remain exactly as returned by
 * Supabase Auth so the OTP continues to verify normally.
 */
export function generateDbmMfaQrCode(
  enrollmentUri: string,
  authenticatedEmail: string,
  enrollmentSecret: string
): { qr: string; label: string } {
  const email = authenticatedEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Email akun belum tersedia untuk label QR MFA.");
  }

  const otpUri = new URL(enrollmentUri);
  if (otpUri.protocol !== "otpauth:" || otpUri.hostname !== "totp" ||
      otpUri.searchParams.get("secret") !== enrollmentSecret) {
    throw new Error("Data QR authenticator dari server tidak valid.");
  }

  const label = `DBM_${email}`;
  otpUri.pathname = `/DBM:${encodeURIComponent(label)}`;
  otpUri.searchParams.set("issuer", "DBM");

  const qrCode = qrcodegen.QrCode.encodeText(
    otpUri.toString(),
    qrcodegen.QrCode.Ecc.MEDIUM
  );
  const quietZone = 4;
  const size = qrCode.size + quietZone * 2;
  const darkPaths: string[] = [];
  for (let y = 0; y < qrCode.size; y += 1) {
    for (let x = 0; x < qrCode.size; x += 1) {
      if (qrCode.getModule(x, y)) {
        darkPaths.push(`M${x + quietZone},${y + quietZone}h1v1h-1z`);
      }
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<path fill="#fff" d="M0 0h${size}v${size}H0z"/>`,
    `<path fill="#000" d="${darkPaths.join("")}"/>`,
    "</svg>",
  ].join("");

  return { label, qr: `data:image/svg+xml,${encodeURIComponent(svg)}` };
}
