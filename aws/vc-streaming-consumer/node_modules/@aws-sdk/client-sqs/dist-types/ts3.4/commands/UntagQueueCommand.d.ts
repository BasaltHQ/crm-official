import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { UntagQueueRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface UntagQueueCommandInput extends UntagQueueRequest {}
export interface UntagQueueCommandOutput extends __MetadataBearer {}
declare const UntagQueueCommand_base: {
  new (
    input: UntagQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    UntagQueueCommandInput,
    UntagQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: UntagQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    UntagQueueCommandInput,
    UntagQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class UntagQueueCommand extends UntagQueueCommand_base {
  protected static __types: {
    api: {
      input: UntagQueueRequest;
      output: {};
    };
    sdk: {
      input: UntagQueueCommandInput;
      output: UntagQueueCommandOutput;
    };
  };
}
