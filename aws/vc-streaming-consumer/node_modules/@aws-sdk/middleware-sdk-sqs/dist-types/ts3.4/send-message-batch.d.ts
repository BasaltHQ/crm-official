import {
  InitializeHandlerOptions,
  InitializeMiddleware,
  Pluggable,
} from "@smithy/types";
import { PreviouslyResolved } from "./configurations";
export declare const sendMessageBatchMiddleware: (
  options: PreviouslyResolved
) => InitializeMiddleware<any, any>;
export declare const sendMessageBatchMiddlewareOptions: InitializeHandlerOptions;
export declare const getSendMessageBatchPlugin: (
  config: PreviouslyResolved
) => Pluggable<any, any>;
