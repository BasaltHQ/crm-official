import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DeleteMessageRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface DeleteMessageCommandInput extends DeleteMessageRequest {}
export interface DeleteMessageCommandOutput extends __MetadataBearer {}
declare const DeleteMessageCommand_base: {
  new (
    input: DeleteMessageCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteMessageCommandInput,
    DeleteMessageCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: DeleteMessageCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteMessageCommandInput,
    DeleteMessageCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class DeleteMessageCommand extends DeleteMessageCommand_base {
  protected static __types: {
    api: {
      input: DeleteMessageRequest;
      output: {};
    };
    sdk: {
      input: DeleteMessageCommandInput;
      output: DeleteMessageCommandOutput;
    };
  };
}
