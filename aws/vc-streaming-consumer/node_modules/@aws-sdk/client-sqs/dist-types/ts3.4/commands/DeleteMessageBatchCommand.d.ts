import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DeleteMessageBatchRequest,
  DeleteMessageBatchResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface DeleteMessageBatchCommandInput
  extends DeleteMessageBatchRequest {}
export interface DeleteMessageBatchCommandOutput
  extends DeleteMessageBatchResult,
    __MetadataBearer {}
declare const DeleteMessageBatchCommand_base: {
  new (
    input: DeleteMessageBatchCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteMessageBatchCommandInput,
    DeleteMessageBatchCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: DeleteMessageBatchCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteMessageBatchCommandInput,
    DeleteMessageBatchCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class DeleteMessageBatchCommand extends DeleteMessageBatchCommand_base {
  protected static __types: {
    api: {
      input: DeleteMessageBatchRequest;
      output: DeleteMessageBatchResult;
    };
    sdk: {
      input: DeleteMessageBatchCommandInput;
      output: DeleteMessageBatchCommandOutput;
    };
  };
}
