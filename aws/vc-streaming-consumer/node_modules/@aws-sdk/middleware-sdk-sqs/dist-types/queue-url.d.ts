import { Endpoint, EndpointV2, FinalizeHandlerArguments, FinalizeHandlerOutput, HandlerExecutionContext, Pluggable, Provider, RelativeMiddlewareOptions } from "@aws-sdk/types";
/**
 * @public
 */
export interface QueueUrlInputConfig {
    /**
     * In cases where a QueueUrl is given as input, that
     * will be preferred as the request endpoint.
     *
     * Set this value to false to ignore the QueueUrl and use the
     * client's resolved endpoint, which may be a custom endpoint.
     */
    useQueueUrlAsEndpoint?: boolean;
}
export interface QueueUrlResolvedConfig {
    useQueueUrlAsEndpoint: boolean;
}
export interface PreviouslyResolved {
    endpoint?: string | Endpoint | Provider<Endpoint> | EndpointV2 | Provider<EndpointV2>;
}
export declare const resolveQueueUrlConfig: <T>(config: T & PreviouslyResolved & QueueUrlInputConfig) => T & QueueUrlResolvedConfig;
/**
 * @internal
 */
export declare function queueUrlMiddleware({ useQueueUrlAsEndpoint, endpoint }: QueueUrlResolvedConfig & PreviouslyResolved): <Output extends object>(next: (args: FinalizeHandlerArguments<any>) => Promise<FinalizeHandlerOutput<Output>>, context: HandlerExecutionContext) => ((args: FinalizeHandlerArguments<any>) => Promise<FinalizeHandlerOutput<Output>>);
/**
 * @internal
 */
export declare const queueUrlMiddlewareOptions: RelativeMiddlewareOptions;
/**
 * @internal
 */
export declare const getQueueUrlPlugin: (config: QueueUrlResolvedConfig) => Pluggable<any, any>;
