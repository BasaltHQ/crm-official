import net from "net";
import dns from "node:dns/promises";
import { isPrivateOrReservedIp } from "@/lib/security/ssrf-guard";

const STRICT_EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

/**
 * Perform a raw SMTP ping to check if an email's domain MX server accepts it.
 * 
 * Returns:
 *  - "accept": Code 250 on RCPT TO
 *  - "reject": Code 5xx on RCPT TO
 *  - "unknown": Connection failed, timeout, or grey-listed (4xx)
 */
export async function nativeSmtpPing(email: string): Promise<"accept" | "reject" | "unknown"> {
  if (
    typeof email !== "string" ||
    email.length === 0 ||
    email.length > 254 ||
    /[\r\n<>\s\x00-\x1f\x7f]/.test(email) ||
    !STRICT_EMAIL_RE.test(email)
  ) {
    return "unknown";
  }

  const normalizedEmail = email.toLowerCase();
  const [localPart, domain] = normalizedEmail.split("@");
  if (!domain || !localPart) return "unknown";

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) return "unknown";

    // Sort by highest priority (lowest number)
    mxRecords.sort((a, b) => a.priority - b.priority);
    const targetMx = mxRecords[0].exchange;
    if (!targetMx || /[\r\n\s\x00-\x1f\x7f]/.test(targetMx)) {
      return "unknown";
    }

    // Block MX records resolving to loopback/RFC1918/link-local addresses
    const mxAddresses = await dns.lookup(targetMx, { all: true, verbatim: true });
    if (!mxAddresses || mxAddresses.length === 0 || mxAddresses.some((rec) => isPrivateOrReservedIp(rec.address))) {
      return "unknown";
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let step = 0;
      let resolved = false;

      const finish = (result: "accept" | "reject" | "unknown") => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(5000, () => finish("unknown"));
      socket.on("error", () => finish("unknown"));

      socket.connect(25, targetMx, () => {
        // Connected! Wait for 220 banner
      });

      socket.on("data", (data) => {
        const response = data.toString();
        const code = parseInt(response.substring(0, 3), 10);

        if (step === 0) {
          if (code === 220) {
            socket.write(`HELO basaltcrm.com\r\n`);
            step++;
          } else {
            finish("unknown");
          }
        } else if (step === 1) {
          if (code === 250) {
            socket.write(`MAIL FROM:<verify@basaltcrm.com>\r\n`);
            step++;
          } else {
            finish("unknown");
          }
        } else if (step === 2) {
          if (code === 250) {
            socket.write(`RCPT TO:<${normalizedEmail}>\r\n`);
            step++;
          } else {
            finish("unknown");
          }
        } else if (step === 3) {
          if (code === 250 || code === 251 || code === 252) {
            socket.write(`QUIT\r\n`);
            finish("accept");
          } else if (code >= 500 && code < 600) {
            socket.write(`QUIT\r\n`);
            finish("reject");
          } else {
            // e.g. 450 greylisted, etc.
            socket.write(`QUIT\r\n`);
            finish("unknown");
          }
        }
      });
    });
  } catch (error) {
    return "unknown";
  }
}
