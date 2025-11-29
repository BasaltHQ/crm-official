import { createPaginator } from "@smithy/core";
import { ListDeadLetterSourceQueuesCommand, } from "../commands/ListDeadLetterSourceQueuesCommand";
import { SQSClient } from "../SQSClient";
export const paginateListDeadLetterSourceQueues = createPaginator(SQSClient, ListDeadLetterSourceQueuesCommand, "NextToken", "NextToken", "MaxResults");
