import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  ChangeMessageVisibilityBatchRequest,
  ChangeMessageVisibilityBatchResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface ChangeMessageVisibilityBatchCommandInput
  extends ChangeMessageVisibilityBatchRequest {}
export interface ChangeMessageVisibilityBatchCommandOutput
  extends ChangeMessageVisibilityBatchResult,
    __MetadataBearer {}
declare const ChangeMessageVisibilityBatchCommand_base: {
  new (
    input: ChangeMessageVisibilityBatchCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ChangeMessageVisibilityBatchCommandInput,
    ChangeMessageVisibilityBatchCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: ChangeMessageVisibilityBatchCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ChangeMessageVisibilityBatchCommandInput,
    ChangeMessageVisibilityBatchCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ChangeMessageVisibilityBatchCommand extends ChangeMessageVisibilityBatchCommand_base {
  protected static __types: {
    api: {
      input: ChangeMessageVisibilityBatchRequest;
      output: ChangeMessageVisibilityBatchResult;
    };
    sdk: {
      input: ChangeMessageVisibilityBatchCommandInput;
      output: ChangeMessageVisibilityBatchCommandOutput;
    };
  };
}
