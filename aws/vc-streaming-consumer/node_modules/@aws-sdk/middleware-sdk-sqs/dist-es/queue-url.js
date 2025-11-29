import { NoOpLogger } from "@smithy/smithy-client";
export const resolveQueueUrlConfig = (config) => {
    return Object.assign(config, {
        useQueueUrlAsEndpoint: config.useQueueUrlAsEndpoint ?? true,
    });
};
export function queueUrlMiddleware({ useQueueUrlAsEndpoint, endpoint }) {
    return (next, context) => {
        return async (args) => {
            const { input } = args;
            const resolvedEndpoint = context.endpointV2;
            if (!endpoint && input.QueueUrl && resolvedEndpoint && useQueueUrlAsEndpoint) {
                const logger = context.logger instanceof NoOpLogger || !context.logger?.warn ? console : context.logger;
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
export const queueUrlMiddlewareOptions = {
    name: "queueUrlMiddleware",
    relation: "after",
    toMiddleware: "endpointV2Middleware",
    override: true,
};
export const getQueueUrlPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo(queueUrlMiddleware(config), queueUrlMiddlewareOptions);
    },
});
