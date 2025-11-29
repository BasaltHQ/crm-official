import { createPaginator } from "@smithy/core";
import { ListQueuesCommand } from "../commands/ListQueuesCommand";
import { SQSClient } from "../SQSClient";
export const paginateListQueues = createPaginator(SQSClient, ListQueuesCommand, "NextToken", "NextToken", "MaxResults");
