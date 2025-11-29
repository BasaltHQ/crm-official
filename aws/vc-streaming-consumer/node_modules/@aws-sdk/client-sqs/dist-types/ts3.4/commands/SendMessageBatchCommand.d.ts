import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  SendMessageBatchRequest,
  SendMessageBatchResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface SendMessageBatchCommandInput extends SendMessageBatchRequest {}
export interface SendMessageBatchCommandOutput
  extends SendMessageBatchResult,
    __MetadataBearer {}
declare const SendMessageBatchCommand_base: {
  new (
    input: SendMessageBatchCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    SendMessageBatchCommandInput,
    SendMessageBatchCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: SendMessageBatchCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    SendMessageBatchCommandInput,
    SendMessageBatchCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class SendMessageBatchCommand extends SendMessageBatchCommand_base {
  protected static __types: {
    api: {
      input: SendMessageBatchRequest;
      output: SendMessageBatchResult;
    };
    sdk: {
      input: SendMessageBatchCommandInput;
      output: SendMessageBatchCommandOutput;
    };
  };
}
