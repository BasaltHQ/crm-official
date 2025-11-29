import { toHex } from "@smithy/util-hex-encoding";
import { toUint8Array } from "@smithy/util-utf8";
export function receiveMessageMiddleware(options) {
    return (next) => async (args) => {
        const resp = await next({ ...args });
        if (options.md5 === false) {
            return resp;
        }
        const output = resp.output;
        const messageIds = [];
        if (output.Messages !== undefined) {
            for (const message of output.Messages) {
                const md5 = message.MD5OfBody;
                const hash = new options.md5();
                hash.update(toUint8Array(message.Body || ""));
                if (md5 !== toHex(await hash.digest())) {
                    messageIds.push(message.MessageId);
                }
            }
        }
        if (messageIds.length > 0) {
            throw new Error("Invalid MD5 checksum on messages: " + messageIds.join(", "));
        }
        return resp;
    };
}
export const receiveMessageMiddlewareOptions = {
    step: "initialize",
    tags: ["VALIDATE_BODY_MD5"],
    name: "receiveMessageMiddleware",
    override: true,
};
export const getReceiveMessagePlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(receiveMessageMiddleware(config), receiveMessageMiddlewareOptions);
    },
});
