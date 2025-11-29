import { Paginator } from "@smithy/types";
import { ListQueuesCommandInput, ListQueuesCommandOutput } from "../commands/ListQueuesCommand";
import { SQSPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateListQueues: (config: SQSPaginationConfiguration, input: ListQueuesCommandInput, ...rest: any[]) => Paginator<ListQueuesCommandOutput>;
