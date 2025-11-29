import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { SendMessageRequest, SendMessageResult } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface SendMessageCommandInput extends SendMessageRequest {}
export interface SendMessageCommandOutput
  extends SendMessageResult,
    __MetadataBearer {}
declare const SendMessageCommand_base: {
  new (
    input: SendMessageCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    SendMessageCommandInput,
    SendMessageCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: SendMessageCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    SendMessageCommandInput,
    SendMessageCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class SendMessageCommand extends SendMessageCommand_base {
  protected static __types: {
    api: {
      input: SendMessageRequest;
      output: SendMessageResult;
    };
    sdk: {
      input: SendMessageCommandInput;
      output: SendMessageCommandOutput;
    };
  };
}
