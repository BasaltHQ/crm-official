import { toHex } from "@smithy/util-hex-encoding";
import { toUint8Array } from "@smithy/util-utf8";
export const sendMessageMiddleware = (options) => (next) => async (args) => {
    const resp = await next({ ...args });
    if (options.md5 === false) {
        return resp;
    }
    const output = resp.output;
    const hash = new options.md5();
    hash.update(toUint8Array(args.input.MessageBody || ""));
    if (output.MD5OfMessageBody !== toHex(await hash.digest())) {
        throw new Error("InvalidChecksumError");
    }
    return resp;
};
export const sendMessageMiddlewareOptions = {
    step: "initialize",
    tags: ["VALIDATE_BODY_MD5"],
    name: "sendMessageMiddleware",
    override: true,
};
export const getSendMessagePlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(sendMessageMiddleware(config), sendMessageMiddlewareOptions);
    },
});
