import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  ReceiveMessageRequest,
  ReceiveMessageResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface ReceiveMessageCommandInput extends ReceiveMessageRequest {}
export interface ReceiveMessageCommandOutput
  extends ReceiveMessageResult,
    __MetadataBearer {}
declare const ReceiveMessageCommand_base: {
  new (
    input: ReceiveMessageCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ReceiveMessageCommandInput,
    ReceiveMessageCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: ReceiveMessageCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ReceiveMessageCommandInput,
    ReceiveMessageCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ReceiveMessageCommand extends ReceiveMessageCommand_base {
  protected static __types: {
    api: {
      input: ReceiveMessageRequest;
      output: ReceiveMessageResult;
    };
    sdk: {
      input: ReceiveMessageCommandInput;
      output: ReceiveMessageCommandOutput;
    };
  };
}
