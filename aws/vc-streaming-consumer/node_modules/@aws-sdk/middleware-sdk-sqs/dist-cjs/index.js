'use strict';

var smithyClient = require('@smithy/smithy-client');
var utilHexEncoding = require('@smithy/util-hex-encoding');
var utilUtf8 = require('@smithy/util-utf8');

const resolveQueueUrlConfig = (config) => {
    return Object.assign(config, {
        useQueueUrlAsEndpoint: config.useQueueUrlAsEndpoint ?? true,
    });
};
function queueUrlMiddleware({ useQueueUrlAsEndpoint, endpoint }) {
    return (next, context) => {
        return async (args) => {
            const { input } = args;
            const resolvedEndpoint = context.endpointV2;
            if (!endpoint && input.QueueUrl && resolvedEndpoint && useQueueUrlAsEndpoint) {
                const logger = context.logger instanceof smithyClient.NoOpLogger || !context.logger?.warn ? console : context.logger;
                try {
                    const queueUrl = new URL(input.QueueUrl);
                    const queueUrlOrigin = new URL(queueUrl.origin);
                    if (resolvedEndpoint.url.origin !== queueUrlOrigin.origin) {
                        logger.warn(`QueueUrl=${input.QueueUrl} differs from SQSClient resolved endpoint=${resolvedEndpoint.url.toString()}, using QueueUrl host as endpoint.
Set [endpoint=string] or [useQueueUrlAsEndpoint=false] on the SQSClient.`);
                        context.endpointV2 = {
                            ...resolvedEndpoint,
                            url: queueUrlOrigin,
                        };
                    }
                }
                catch (e) {
                    logger.warn(e);
                }
            }
            return next(args);
        };
    };
}
const queueUrlMiddlewareOptions = {
    name: "queueUrlMiddleware",
    relation: "after",
    toMiddleware: "endpointV2Middleware",
    override: true,
};
const getQueueUrlPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo(queueUrlMiddleware(config), queueUrlMiddlewareOptions);
    },
});

function receiveMessageMiddleware(options) {
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
                hash.update(utilUtf8.toUint8Array(message.Body || ""));
                if (md5 !== utilHexEncoding.toHex(await hash.digest())) {
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
const receiveMessageMiddlewareOptions = {
    step: "initialize",
    tags: ["VALIDATE_BODY_MD5"],
    name: "receiveMessageMiddleware",
    override: true,
};
const getReceiveMessagePlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(receiveMessageMiddleware(config), receiveMessageMiddlewareOptions);
    },
});

const sendMessageMiddleware = (options) => (next) => async (args) => {
    const resp = await next({ ...args });
    if (options.md5 === false) {
        return resp;
    }
    const output = resp.output;
    const hash = new options.md5();
    hash.update(utilUtf8.toUint8Array(args.input.MessageBody || ""));
    if (output.MD5OfMessageBody !== utilHexEncoding.toHex(await hash.digest())) {
        throw new Error("InvalidChecksumError");
    }
    return resp;
};
const sendMessageMiddlewareOptions = {
    step: "initialize",
    tags: ["VALIDATE_BODY_MD5"],
    name: "sendMessageMiddleware",
    override: true,
};
const getSendMessagePlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(sendMessageMiddleware(config), sendMessageMiddlewareOptions);
    },
});

const sendMessageBatchMiddleware = (options) => (next) => async (args) => {
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
            hash.update(utilUtf8.toUint8Array(entry.MessageBody || ""));
            if (md5 !== utilHexEncoding.toHex(await hash.digest())) {
                messageIds.push(entries[entry.Id].MessageId);
            }
        }
    }
    if (messageIds.length > 0) {
        throw new Error("Invalid MD5 checksum on messages: " + messageIds.join(", "));
    }
    return resp;
};
const sendMessageBatchMiddlewareOptions = {
    step: "initialize",
    tags: ["VALIDATE_BODY_MD5"],
    name: "sendMessageBatchMiddleware",
    override: true,
};
const getSendMessageBatchPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(sendMessageBatchMiddleware(config), sendMessageBatchMiddlewareOptions);
    },
});

exports.getQueueUrlPlugin = getQueueUrlPlugin;
exports.getReceiveMessagePlugin = getReceiveMessagePlugin;
exports.getSendMessageBatchPlugin = getSendMessageBatchPlugin;
exports.getSendMessagePlugin = getSendMessagePlugin;
exports.queueUrlMiddleware = queueUrlMiddleware;
exports.queueUrlMiddlewareOptions = queueUrlMiddlewareOptions;
exports.receiveMessageMiddleware = receiveMessageMiddleware;
exports.receiveMessageMiddlewareOptions = receiveMessageMiddlewareOptions;
exports.resolveQueueUrlConfig = resolveQueueUrlConfig;
exports.sendMessageBatchMiddleware = sendMessageBatchMiddleware;
exports.sendMessageBatchMiddlewareOptions = sendMessageBatchMiddlewareOptions;
exports.sendMessageMiddleware = sendMessageMiddleware;
exports.sendMessageMiddlewareOptions = sendMessageMiddlewareOptions;
