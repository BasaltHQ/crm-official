import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { SetQueueAttributesRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface SetQueueAttributesCommandInput
  extends SetQueueAttributesRequest {}
export interface SetQueueAttributesCommandOutput extends __MetadataBearer {}
declare const SetQueueAttributesCommand_base: {
  new (
    input: SetQueueAttributesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    SetQueueAttributesCommandInput,
    SetQueueAttributesCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: SetQueueAttributesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    SetQueueAttributesCommandInput,
    SetQueueAttributesCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class SetQueueAttributesCommand extends SetQueueAttributesCommand_base {
  protected static __types: {
    api: {
      input: SetQueueAttributesRequest;
      output: {};
    };
    sdk: {
      input: SetQueueAttributesCommandInput;
      output: SetQueueAttributesCommandOutput;
    };
  };
}
