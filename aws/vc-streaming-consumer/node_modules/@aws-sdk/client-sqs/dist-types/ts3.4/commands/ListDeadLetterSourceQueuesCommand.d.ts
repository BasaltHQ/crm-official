import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  ListDeadLetterSourceQueuesRequest,
  ListDeadLetterSourceQueuesResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface ListDeadLetterSourceQueuesCommandInput
  extends ListDeadLetterSourceQueuesRequest {}
export interface ListDeadLetterSourceQueuesCommandOutput
  extends ListDeadLetterSourceQueuesResult,
    __MetadataBearer {}
declare const ListDeadLetterSourceQueuesCommand_base: {
  new (
    input: ListDeadLetterSourceQueuesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListDeadLetterSourceQueuesCommandInput,
    ListDeadLetterSourceQueuesCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: ListDeadLetterSourceQueuesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListDeadLetterSourceQueuesCommandInput,
    ListDeadLetterSourceQueuesCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListDeadLetterSourceQueuesCommand extends ListDeadLetterSourceQueuesCommand_base {
  protected static __types: {
    api: {
      input: ListDeadLetterSourceQueuesRequest;
      output: ListDeadLetterSourceQueuesResult;
    };
    sdk: {
      input: ListDeadLetterSourceQueuesCommandInput;
      output: ListDeadLetterSourceQueuesCommandOutput;
    };
  };
}
