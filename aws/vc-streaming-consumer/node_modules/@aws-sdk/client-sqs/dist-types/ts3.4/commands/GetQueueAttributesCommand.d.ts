import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  GetQueueAttributesRequest,
  GetQueueAttributesResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface GetQueueAttributesCommandInput
  extends GetQueueAttributesRequest {}
export interface GetQueueAttributesCommandOutput
  extends GetQueueAttributesResult,
    __MetadataBearer {}
declare const GetQueueAttributesCommand_base: {
  new (
    input: GetQueueAttributesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    GetQueueAttributesCommandInput,
    GetQueueAttributesCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: GetQueueAttributesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    GetQueueAttributesCommandInput,
    GetQueueAttributesCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class GetQueueAttributesCommand extends GetQueueAttributesCommand_base {
  protected static __types: {
    api: {
      input: GetQueueAttributesRequest;
      output: GetQueueAttributesResult;
    };
    sdk: {
      input: GetQueueAttributesCommandInput;
      output: GetQueueAttributesCommandOutput;
    };
  };
}
