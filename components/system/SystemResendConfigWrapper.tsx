import { prismadb } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import SystemResendConfig from "./SystemResendConfig";

function maskServerKey(raw: string | null | undefined): string | undefined {
    if (!raw) return undefined;
    const plain = decryptSecret(raw) || raw;
    if (plain.length <= 8) return "••••••••";
    return `${plain.slice(0, 4)}••••••••••${plain.slice(-4)}`;
}

const SystemResendConfigWrapper = async () => {
    const resend_key = await prismadb.systemServices.findFirst({
        where: {
            name: "resend_smtp",
        },
    });

    const maskedEnvKey = maskServerKey(process.env.RESEND_API_KEY);
    const maskedDbKey = maskServerKey(resend_key?.serviceKey);
    const resendKeyId = resend_key?.id ?? "";

    return (
        <SystemResendConfig
            resendKeyId={resendKeyId}
            envKey={maskedEnvKey}
            dbKey={maskedDbKey}
        />
    );
};

export default SystemResendConfigWrapper;
