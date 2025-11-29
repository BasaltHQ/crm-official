import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ListQueueTagsRequest, ListQueueTagsResult } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface ListQueueTagsCommandInput extends ListQueueTagsRequest {}
export interface ListQueueTagsCommandOutput
  extends ListQueueTagsResult,
    __MetadataBearer {}
declare const ListQueueTagsCommand_base: {
  new (
    input: ListQueueTagsCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListQueueTagsCommandInput,
    ListQueueTagsCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: ListQueueTagsCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListQueueTagsCommandInput,
    ListQueueTagsCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListQueueTagsCommand extends ListQueueTagsCommand_base {
  protected static __types: {
    api: {
      input: ListQueueTagsRequest;
      output: ListQueueTagsResult;
    };
    sdk: {
      input: ListQueueTagsCommandInput;
      output: ListQueueTagsCommandOutput;
    };
  };
}
