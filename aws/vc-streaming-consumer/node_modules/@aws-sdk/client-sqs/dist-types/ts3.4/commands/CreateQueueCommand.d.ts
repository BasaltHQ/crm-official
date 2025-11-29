import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { CreateQueueRequest, CreateQueueResult } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface CreateQueueCommandInput extends CreateQueueRequest {}
export interface CreateQueueCommandOutput
  extends CreateQueueResult,
    __MetadataBearer {}
declare const CreateQueueCommand_base: {
  new (
    input: CreateQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    CreateQueueCommandInput,
    CreateQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: CreateQueueCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    CreateQueueCommandInput,
    CreateQueueCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class CreateQueueCommand extends CreateQueueCommand_base {
  protected static __types: {
    api: {
      input: CreateQueueRequest;
      output: CreateQueueResult;
    };
    sdk: {
      input: CreateQueueCommandInput;
      output: CreateQueueCommandOutput;
    };
  };
}
