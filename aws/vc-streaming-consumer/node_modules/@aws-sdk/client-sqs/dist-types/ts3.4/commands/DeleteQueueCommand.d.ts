import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DeleteQueueRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface DeleteQueueCommandInput extends DeleteQueueRequest {}
export interface DeleteQueueCommandOutput extends __MetadataBearer {}
declare const DeleteQueueCommand_base: {
  new (
    input: DeleteQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteQueueCommandInput,
    DeleteQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: DeleteQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteQueueCommandInput,
    DeleteQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class DeleteQueueCommand extends DeleteQueueCommand_base {
  protected static __types: {
    api: {
      input: DeleteQueueRequest;
      output: {};
    };
    sdk: {
      input: DeleteQueueCommandInput;
      output: DeleteQueueCommandOutput;
    };
  };
}
