import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ChangeMessageVisibilityRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface ChangeMessageVisibilityCommandInput
  extends ChangeMessageVisibilityRequest {}
export interface ChangeMessageVisibilityCommandOutput
  extends __MetadataBearer {}
declare const ChangeMessageVisibilityCommand_base: {
  new (
    input: ChangeMessageVisibilityCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ChangeMessageVisibilityCommandInput,
    ChangeMessageVisibilityCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: ChangeMessageVisibilityCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ChangeMessageVisibilityCommandInput,
    ChangeMessageVisibilityCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ChangeMessageVisibilityCommand extends ChangeMessageVisibilityCommand_base {
  protected static __types: {
    api: {
      input: ChangeMessageVisibilityRequest;
      output: {};
    };
    sdk: {
      input: ChangeMessageVisibilityCommandInput;
      output: ChangeMessageVisibilityCommandOutput;
    };
  };
}
