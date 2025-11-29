import { toHex } from "@smithy/util-hex-encoding";
import { toUint8Array } from "@smithy/util-utf8";
export const sendMessageBatchMiddleware = (options) => (next) => async (args) => {
    const resp = await next({ ...args });
    if (options.md5 === false) {
        return resp;
    }
    const output = resp.output;
    const messageIds = [];
    const entries = {};
    if (output.Successful !== undefined) {
        for (const entry of output.Successful) {
            if (entry.Id !== undefined) {
                entries[entry.Id] = entry;
            }
        }
    }
    for (const entry of args.input.Entries) {
        if (entries[entry.Id]) {
            const md5 = entries[entry.Id].MD5OfMessageBody;
            const hash = new options.md5();
            hash.update(toUint8Array(entry.MessageBody || ""));
            if (md5 !== toHex(await hash.digest())) {
                messageIds.push(entries[entry.Id].MessageId);
            }
        }
    }
    if (messageIds.length > 0) {
        throw new Error("Invalid MD5 checksum on messages: " + messageIds.join(", "));
    }
    return resp;
};
export const sendMessageBatchMiddlewareOptions = {
    step: "initialize",
    tags: ["VALIDATE_BODY_MD5"],
    name: "sendMessageBatchMiddleware",
    override: true,
};
export const getSendMessageBatchPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(sendMessageBatchMiddleware(config), sendMessageBatchMiddlewareOptions);
    },
});
