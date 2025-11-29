import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { GetQueueUrlRequest, GetQueueUrlResult } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface GetQueueUrlCommandInput extends GetQueueUrlRequest {}
export interface GetQueueUrlCommandOutput
  extends GetQueueUrlResult,
    __MetadataBearer {}
declare const GetQueueUrlCommand_base: {
  new (
    input: GetQueueUrlCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    GetQueueUrlCommandInput,
    GetQueueUrlCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: GetQueueUrlCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    GetQueueUrlCommandInput,
    GetQueueUrlCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class GetQueueUrlCommand extends GetQueueUrlCommand_base {
  protected static __types: {
    api: {
      input: GetQueueUrlRequest;
      output: GetQueueUrlResult;
    };
    sdk: {
      input: GetQueueUrlCommandInput;
      output: GetQueueUrlCommandOutput;
    };
  };
}
