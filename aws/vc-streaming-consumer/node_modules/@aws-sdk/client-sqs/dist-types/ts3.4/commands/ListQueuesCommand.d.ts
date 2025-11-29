import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ListQueuesRequest, ListQueuesResult } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface ListQueuesCommandInput extends ListQueuesRequest {}
export interface ListQueuesCommandOutput
  extends ListQueuesResult,
    __MetadataBearer {}
declare const ListQueuesCommand_base: {
  new (
    input: ListQueuesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListQueuesCommandInput,
    ListQueuesCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [ListQueuesCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    ListQueuesCommandInput,
    ListQueuesCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListQueuesCommand extends ListQueuesCommand_base {
  protected static __types: {
    api: {
      input: ListQueuesRequest;
      output: ListQueuesResult;
    };
    sdk: {
      input: ListQueuesCommandInput;
      output: ListQueuesCommandOutput;
    };
  };
}
