import { PaginationConfiguration } from "@smithy/types";
import { SQSClient } from "../SQSClient";
export interface SQSPaginationConfiguration extends PaginationConfiguration {
  client: SQSClient;
}
