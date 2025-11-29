import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  CancelMessageMoveTaskRequest,
  CancelMessageMoveTaskResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface CancelMessageMoveTaskCommandInput
  extends CancelMessageMoveTaskRequest {}
export interface CancelMessageMoveTaskCommandOutput
  extends CancelMessageMoveTaskResult,
    __MetadataBearer {}
declare const CancelMessageMoveTaskCommand_base: {
  new (
    input: CancelMessageMoveTaskCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    CancelMessageMoveTaskCommandInput,
    CancelMessageMoveTaskCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: CancelMessageMoveTaskCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    CancelMessageMoveTaskCommandInput,
    CancelMessageMoveTaskCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class CancelMessageMoveTaskCommand extends CancelMessageMoveTaskCommand_base {
  protected static __types: {
    api: {
      input: CancelMessageMoveTaskRequest;
      output: CancelMessageMoveTaskResult;
    };
    sdk: {
      input: CancelMessageMoveTaskCommandInput;
      output: CancelMessageMoveTaskCommandOutput;
    };
  };
}
