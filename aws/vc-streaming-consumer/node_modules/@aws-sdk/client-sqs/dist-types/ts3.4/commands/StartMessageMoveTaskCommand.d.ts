import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  StartMessageMoveTaskRequest,
  StartMessageMoveTaskResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface StartMessageMoveTaskCommandInput
  extends StartMessageMoveTaskRequest {}
export interface StartMessageMoveTaskCommandOutput
  extends StartMessageMoveTaskResult,
    __MetadataBearer {}
declare const StartMessageMoveTaskCommand_base: {
  new (
    input: StartMessageMoveTaskCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    StartMessageMoveTaskCommandInput,
    StartMessageMoveTaskCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: StartMessageMoveTaskCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    StartMessageMoveTaskCommandInput,
    StartMessageMoveTaskCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class StartMessageMoveTaskCommand extends StartMessageMoveTaskCommand_base {
  protected static __types: {
    api: {
      input: StartMessageMoveTaskRequest;
      output: StartMessageMoveTaskResult;
    };
    sdk: {
      input: StartMessageMoveTaskCommandInput;
      output: StartMessageMoveTaskCommandOutput;
    };
  };
}
