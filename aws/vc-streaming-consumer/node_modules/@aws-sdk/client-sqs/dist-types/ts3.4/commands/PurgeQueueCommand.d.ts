import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { PurgeQueueRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface PurgeQueueCommandInput extends PurgeQueueRequest {}
export interface PurgeQueueCommandOutput extends __MetadataBearer {}
declare const PurgeQueueCommand_base: {
  new (
    input: PurgeQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    PurgeQueueCommandInput,
    PurgeQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: PurgeQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    PurgeQueueCommandInput,
    PurgeQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class PurgeQueueCommand extends PurgeQueueCommand_base {
  protected static __types: {
    api: {
      input: PurgeQueueRequest;
      output: {};
    };
    sdk: {
      input: PurgeQueueCommandInput;
      output: PurgeQueueCommandOutput;
    };
  };
}
