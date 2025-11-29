import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { AddPermissionRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer };
export { $Command };
export interface AddPermissionCommandInput extends AddPermissionRequest {}
export interface AddPermissionCommandOutput extends __MetadataBearer {}
declare const AddPermissionCommand_base: {
  new (
    input: AddPermissionCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    AddPermissionCommandInput,
    AddPermissionCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: AddPermissionCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    AddPermissionCommandInput,
    AddPermissionCommandOutput,
    SQSClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class AddPermissionCommand extends AddPermissionCommand_base {
  protected static __types: {
    api: {
      input: AddPermissionRequest;
      output: {};
    };
    sdk: {
      input: AddPermissionCommandInput;
      output: AddPermissionCommandOutput;
    };
  };
}
