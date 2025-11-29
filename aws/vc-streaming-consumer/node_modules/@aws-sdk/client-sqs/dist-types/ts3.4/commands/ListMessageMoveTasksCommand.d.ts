import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  ListMessageMoveTasksRequest,
  ListMessageMoveTasksResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface ListMessageMoveTasksCommandInput
  extends ListMessageMoveTasksRequest {}
export interface ListMessageMoveTasksCommandOutput
  extends ListMessageMoveTasksResult,
    __MetadataBearer {}
declare const ListMessageMoveTasksCommand_base: {
  new (
    input: ListMessageMoveTasksCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListMessageMoveTasksCommandInput,
    ListMessageMoveTasksCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: ListMessageMoveTasksCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListMessageMoveTasksCommandInput,
    ListMessageMoveTasksCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListMessageMoveTasksCommand extends ListMessageMoveTasksCommand_base {
  protected static __types: {
    api: {
      input: ListMessageMoveTasksRequest;
      output: ListMessageMoveTasksResult;
    };
    sdk: {
      input: ListMessageMoveTasksCommandInput;
      output: ListMessageMoveTasksCommandOutput;
    };
  };
}
