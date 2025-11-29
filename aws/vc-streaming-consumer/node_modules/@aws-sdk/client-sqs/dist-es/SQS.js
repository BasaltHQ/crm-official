import { createAggregatedClient } from "@smithy/smithy-client";
import { AddPermissionCommand, } from "./commands/AddPermissionCommand";
import { CancelMessageMoveTaskCommand, } from "./commands/CancelMessageMoveTaskCommand";
import { ChangeMessageVisibilityBatchCommand, } from "./commands/ChangeMessageVisibilityBatchCommand";
import { ChangeMessageVisibilityCommand, } from "./commands/ChangeMessageVisibilityCommand";
import { CreateQueueCommand } from "./commands/CreateQueueCommand";
import { DeleteMessageBatchCommand, } from "./commands/DeleteMessageBatchCommand";
import { DeleteMessageCommand, } from "./commands/DeleteMessageCommand";
import { DeleteQueueCommand } from "./commands/DeleteQueueCommand";
import { GetQueueAttributesCommand, } from "./commands/GetQueueAttributesCommand";
import { GetQueueUrlCommand } from "./commands/GetQueueUrlCommand";
import { ListDeadLetterSourceQueuesCommand, } from "./commands/ListDeadLetterSourceQueuesCommand";
import { ListMessageMoveTasksCommand, } from "./commands/ListMessageMoveTasksCommand";
import { ListQueuesCommand } from "./commands/ListQueuesCommand";
import { ListQueueTagsCommand, } from "./commands/ListQueueTagsCommand";
import { PurgeQueueCommand } from "./commands/PurgeQueueCommand";
import { ReceiveMessageCommand, } from "./commands/ReceiveMessageCommand";
import { RemovePermissionCommand, } from "./commands/RemovePermissionCommand";
import { SendMessageBatchCommand, } from "./commands/SendMessageBatchCommand";
import { SendMessageCommand } from "./commands/SendMessageCommand";
import { SetQueueAttributesCommand, } from "./commands/SetQueueAttributesCommand";
import { StartMessageMoveTaskCommand, } from "./commands/StartMessageMoveTaskCommand";
import { TagQueueCommand } from "./commands/TagQueueCommand";
import { UntagQueueCommand } from "./commands/UntagQueueCommand";
import { SQSClient } from "./SQSClient";
const commands = {
    AddPermissionCommand,
    CancelMessageMoveTaskCommand,
    ChangeMessageVisibilityCommand,
    ChangeMessageVisibilityBatchCommand,
    CreateQueueCommand,
    DeleteMessageCommand,
    DeleteMessageBatchCommand,
    DeleteQueueCommand,
    GetQueueAttributesCommand,
    GetQueueUrlCommand,
    ListDeadLetterSourceQueuesCommand,
    ListMessageMoveTasksCommand,
    ListQueuesCommand,
    ListQueueTagsCommand,
    PurgeQueueCommand,
    ReceiveMessageCommand,
    RemovePermissionCommand,
    SendMessageCommand,
    SendMessageBatchCommand,
    SetQueueAttributesCommand,
    StartMessageMoveTaskCommand,
    TagQueueCommand,
    UntagQueueCommand,
};
export class SQS extends SQSClient {
}
createAggregatedClient(commands, SQS);
