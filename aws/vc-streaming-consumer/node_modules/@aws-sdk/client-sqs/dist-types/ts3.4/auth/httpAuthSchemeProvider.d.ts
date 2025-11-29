import {
  AwsSdkSigV4AuthInputConfig,
  AwsSdkSigV4AuthResolvedConfig,
  AwsSdkSigV4PreviouslyResolved,
} from "@aws-sdk/core";
import {
  HandlerExecutionContext,
  HttpAuthScheme,
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  HttpAuthSchemeProvider,
  Provider,
} from "@smithy/types";
import { SQSClientResolvedConfig } from "../SQSClient";
export interface SQSHttpAuthSchemeParameters extends HttpAuthSchemeParameters {
  region?: string;
}
export interface SQSHttpAuthSchemeParametersProvider
  extends HttpAuthSchemeParametersProvider<
    SQSClientResolvedConfig,
    HandlerExecutionContext,
    SQSHttpAuthSchemeParameters,
    object
  > {}
export declare const defaultSQSHttpAuthSchemeParametersProvider: (
  config: SQSClientResolvedConfig,
  context: HandlerExecutionContext,
  input: object
) => Promise<SQSHttpAuthSchemeParameters>;
export interface SQSHttpAuthSchemeProvider
  extends HttpAuthSchemeProvider<SQSHttpAuthSchemeParameters> {}
export declare const defaultSQSHttpAuthSchemeProvider: SQSHttpAuthSchemeProvider;
export interface HttpAuthSchemeInputConfig extends AwsSdkSigV4AuthInputConfig {
  authSchemePreference?: string[] | Provider<string[]>;
  httpAuthSchemes?: HttpAuthScheme[];
  httpAuthSchemeProvider?: SQSHttpAuthSchemeProvider;
}
export interface HttpAuthSchemeResolvedConfig
  extends AwsSdkSigV4AuthResolvedConfig {
  readonly authSchemePreference: Provider<string[]>;
  readonly httpAuthSchemes: HttpAuthScheme[];
  readonly httpAuthSchemeProvider: SQSHttpAuthSchemeProvider;
}
export declare const resolveHttpAuthSchemeConfig: <T>(
  config: T & HttpAuthSchemeInputConfig & AwsSdkSigV4PreviouslyResolved
) => T & HttpAuthSchemeResolvedConfig;
