import {
  Endpoint,
  EndpointV2,
  FinalizeHandlerArguments,
  FinalizeHandlerOutput,
  HandlerExecutionContext,
  Pluggable,
  Provider,
  RelativeMiddlewareOptions,
} from "@aws-sdk/types";
export interface QueueUrlInputConfig {
  useQueueUrlAsEndpoint?: boolean;
}
export interface QueueUrlResolvedConfig {
  useQueueUrlAsEndpoint: boolean;
}
export interface PreviouslyResolved {
  endpoint?:
    | string
    | Endpoint
    | Provider<Endpoint>
    | EndpointV2
    | Provider<EndpointV2>;
}
export declare const resolveQueueUrlConfig: <T>(
  config: T & PreviouslyResolved & QueueUrlInputConfig
) => T & QueueUrlResolvedConfig;
export declare function queueUrlMiddleware({
  useQueueUrlAsEndpoint,
  endpoint,
}: QueueUrlResolvedConfig & PreviouslyResolved): <Output extends object>(
  next: (
    args: FinalizeHandlerArguments<any>
  ) => Promise<FinalizeHandlerOutput<Output>>,
  context: HandlerExecutionContext
) => (
  args: FinalizeHandlerArguments<any>
) => Promise<FinalizeHandlerOutput<Output>>;
export declare const queueUrlMiddlewareOptions: RelativeMiddlewareOptions;
export declare const getQueueUrlPlugin: (
  config: QueueUrlResolvedConfig
) => Pluggable<any, any>;
