import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { TagQueueRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface TagQueueCommandInput extends TagQueueRequest {}
export interface TagQueueCommandOutput extends __MetadataBearer {}
declare const TagQueueCommand_base: {
  new (
    input: TagQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    TagQueueCommandInput,
    TagQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: TagQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    TagQueueCommandInput,
    TagQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class TagQueueCommand extends TagQueueCommand_base {
  protected static __types: {
    api: {
      input: TagQueueRequest;
      output: {};
    };
    sdk: {
      input: TagQueueCommandInput;
      output: TagQueueCommandOutput;
    };
  };
}
