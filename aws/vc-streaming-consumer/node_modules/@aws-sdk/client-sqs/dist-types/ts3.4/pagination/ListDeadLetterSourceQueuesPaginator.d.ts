import { Paginator } from "@smithy/types";
import {
  ListDeadLetterSourceQueuesCommandInput,
  ListDeadLetterSourceQueuesCommandOutput,
} from "../commands/ListDeadLetterSourceQueuesCommand";
import { SQSPaginationConfiguration } from "./Interfaces";
export declare const paginateListDeadLetterSourceQueues: (
  config: SQSPaginationConfiguration,
  input: ListDeadLetterSourceQueuesCommandInput,
  ...rest: any[]
) => Paginator<ListDeadLetterSourceQueuesCommandOutput>;
