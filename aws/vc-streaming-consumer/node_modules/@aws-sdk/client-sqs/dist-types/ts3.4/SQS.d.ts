import { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";
import {
  AddPermissionCommandInput,
  AddPermissionCommandOutput,
} from "./commands/AddPermissionCommand";
import {
  CancelMessageMoveTaskCommandInput,
  CancelMessageMoveTaskCommandOutput,
} from "./commands/CancelMessageMoveTaskCommand";
import {
  ChangeMessageVisibilityBatchCommandInput,
  ChangeMessageVisibilityBatchCommandOutput,
} from "./commands/ChangeMessageVisibilityBatchCommand";
import {
  ChangeMessageVisibilityCommandInput,
  ChangeMessageVisibilityCommandOutput,
} from "./commands/ChangeMessageVisibilityCommand";
import {
  CreateQueueCommandInput,
  CreateQueueCommandOutput,
} from "./commands/CreateQueueCommand";
import {
  DeleteMessageBatchCommandInput,
  DeleteMessageBatchCommandOutput,
} from "./commands/DeleteMessageBatchCommand";
import {
  DeleteMessageCommandInput,
  DeleteMessageCommandOutput,
} from "./commands/DeleteMessageCommand";
import {
  DeleteQueueCommandInput,
  DeleteQueueCommandOutput,
} from "./commands/DeleteQueueCommand";
import {
  GetQueueAttributesCommandInput,
  GetQueueAttributesCommandOutput,
} from "./commands/GetQueueAttributesCommand";
import {
  GetQueueUrlCommandInput,
  GetQueueUrlCommandOutput,
} from "./commands/GetQueueUrlCommand";
import {
  ListDeadLetterSourceQueuesCommandInput,
  ListDeadLetterSourceQueuesCommandOutput,
} from "./commands/ListDeadLetterSourceQueuesCommand";
import {
  ListMessageMoveTasksCommandInput,
  ListMessageMoveTasksCommandOutput,
} from "./commands/ListMessageMoveTasksCommand";
import {
  ListQueuesCommandInput,
  ListQueuesCommandOutput,
} from "./commands/ListQueuesCommand";
import {
  ListQueueTagsCommandInput,
  ListQueueTagsCommandOutput,
} from "./commands/ListQueueTagsCommand";
import {
  PurgeQueueCommandInput,
  PurgeQueueCommandOutput,
} from "./commands/PurgeQueueCommand";
import {
  ReceiveMessageCommandInput,
  ReceiveMessageCommandOutput,
} from "./commands/ReceiveMessageCommand";
import {
  RemovePermissionCommandInput,
  RemovePermissionCommandOutput,
} from "./commands/RemovePermissionCommand";
import {
  SendMessageBatchCommandInput,
  SendMessageBatchCommandOutput,
} from "./commands/SendMessageBatchCommand";
import {
  SendMessageCommandInput,
  SendMessageCommandOutput,
} from "./commands/SendMessageCommand";
import {
  SetQueueAttributesCommandInput,
  SetQueueAttributesCommandOutput,
} from "./commands/SetQueueAttributesCommand";
import {
  StartMessageMoveTaskCommandInput,
  StartMessageMoveTaskCommandOutput,
} from "./commands/StartMessageMoveTaskCommand";
import {
  TagQueueCommandInput,
  TagQueueCommandOutput,
} from "./commands/TagQueueCommand";
import {
  UntagQueueCommandInput,
  UntagQueueCommandOutput,
} from "./commands/UntagQueueCommand";
import { SQSClient } from "./SQSClient";
export interface SQS {
  addPermission(
    args: AddPermissionCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<AddPermissionCommandOutput>;
  addPermission(
    args: AddPermissionCommandInput,
    cb: (err: any, data?: AddPermissionCommandOutput) => void
  ): void;
  addPermission(
    args: AddPermissionCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: AddPermissionCommandOutput) => void
  ): void;
  cancelMessageMoveTask(
    args: CancelMessageMoveTaskCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<CancelMessageMoveTaskCommandOutput>;
  cancelMessageMoveTask(
    args: CancelMessageMoveTaskCommandInput,
    cb: (err: any, data?: CancelMessageMoveTaskCommandOutput) => void
  ): void;
  cancelMessageMoveTask(
    args: CancelMessageMoveTaskCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CancelMessageMoveTaskCommandOutput) => void
  ): void;
  changeMessageVisibility(
    args: ChangeMessageVisibilityCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<ChangeMessageVisibilityCommandOutput>;
  changeMessageVisibility(
    args: ChangeMessageVisibilityCommandInput,
    cb: (err: any, data?: ChangeMessageVisibilityCommandOutput) => void
  ): void;
  changeMessageVisibility(
    args: ChangeMessageVisibilityCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ChangeMessageVisibilityCommandOutput) => void
  ): void;
  changeMessageVisibilityBatch(
    args: ChangeMessageVisibilityBatchCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<ChangeMessageVisibilityBatchCommandOutput>;
  changeMessageVisibilityBatch(
    args: ChangeMessageVisibilityBatchCommandInput,
    cb: (err: any, data?: ChangeMessageVisibilityBatchCommandOutput) => void
  ): void;
  changeMessageVisibilityBatch(
    args: ChangeMessageVisibilityBatchCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ChangeMessageVisibilityBatchCommandOutput) => void
  ): void;
  createQueue(
    args: CreateQueueCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<CreateQueueCommandOutput>;
  createQueue(
    args: CreateQueueCommandInput,
    cb: (err: any, data?: CreateQueueCommandOutput) => void
  ): void;
  createQueue(
    args: CreateQueueCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreateQueueCommandOutput) => void
  ): void;
  deleteMessage(
    args: DeleteMessageCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<DeleteMessageCommandOutput>;
  deleteMessage(
    args: DeleteMessageCommandInput,
    cb: (err: any, data?: DeleteMessageCommandOutput) => void
  ): void;
  deleteMessage(
    args: DeleteMessageCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: DeleteMessageCommandOutput) => void
  ): void;
  deleteMessageBatch(
    args: DeleteMessageBatchCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<DeleteMessageBatchCommandOutput>;
  deleteMessageBatch(
    args: DeleteMessageBatchCommandInput,
    cb: (err: any, data?: DeleteMessageBatchCommandOutput) => void
  ): void;
  deleteMessageBatch(
    args: DeleteMessageBatchCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: DeleteMessageBatchCommandOutput) => void
  ): void;
  deleteQueue(
    args: DeleteQueueCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<DeleteQueueCommandOutput>;
  deleteQueue(
    args: DeleteQueueCommandInput,
    cb: (err: any, data?: DeleteQueueCommandOutput) => void
  ): void;
  deleteQueue(
    args: DeleteQueueCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: DeleteQueueCommandOutput) => void
  ): void;
  getQueueAttributes(
    args: GetQueueAttributesCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<GetQueueAttributesCommandOutput>;
  getQueueAttributes(
    args: GetQueueAttributesCommandInput,
    cb: (err: any, data?: GetQueueAttributesCommandOutput) => void
  ): void;
  getQueueAttributes(
    args: GetQueueAttributesCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetQueueAttributesCommandOutput) => void
  ): void;
  getQueueUrl(
    args: GetQueueUrlCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<GetQueueUrlCommandOutput>;
  getQueueUrl(
    args: GetQueueUrlCommandInput,
    cb: (err: any, data?: GetQueueUrlCommandOutput) => void
  ): void;
  getQueueUrl(
    args: GetQueueUrlCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetQueueUrlCommandOutput) => void
  ): void;
  listDeadLetterSourceQueues(
    args: ListDeadLetterSourceQueuesCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<ListDeadLetterSourceQueuesCommandOutput>;
  listDeadLetterSourceQueues(
    args: ListDeadLetterSourceQueuesCommandInput,
    cb: (err: any, data?: ListDeadLetterSourceQueuesCommandOutput) => void
  ): void;
  listDeadLetterSourceQueues(
    args: ListDeadLetterSourceQueuesCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListDeadLetterSourceQueuesCommandOutput) => void
  ): void;
  listMessageMoveTasks(
    args: ListMessageMoveTasksCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<ListMessageMoveTasksCommandOutput>;
  listMessageMoveTasks(
    args: ListMessageMoveTasksCommandInput,
    cb: (err: any, data?: ListMessageMoveTasksCommandOutput) => void
  ): void;
  listMessageMoveTasks(
    args: ListMessageMoveTasksCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListMessageMoveTasksCommandOutput) => void
  ): void;
  listQueues(): Promise<ListQueuesCommandOutput>;
  listQueues(
    args: ListQueuesCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<ListQueuesCommandOutput>;
  listQueues(
    args: ListQueuesCommandInput,
    cb: (err: any, data?: ListQueuesCommandOutput) => void
  ): void;
  listQueues(
    args: ListQueuesCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListQueuesCommandOutput) => void
  ): void;
  listQueueTags(
    args: ListQueueTagsCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<ListQueueTagsCommandOutput>;
  listQueueTags(
    args: ListQueueTagsCommandInput,
    cb: (err: any, data?: ListQueueTagsCommandOutput) => void
  ): void;
  listQueueTags(
    args: ListQueueTagsCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListQueueTagsCommandOutput) => void
  ): void;
  purgeQueue(
    args: PurgeQueueCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<PurgeQueueCommandOutput>;
  purgeQueue(
    args: PurgeQueueCommandInput,
    cb: (err: any, data?: PurgeQueueCommandOutput) => void
  ): void;
  purgeQueue(
    args: PurgeQueueCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: PurgeQueueCommandOutput) => void
  ): void;
  receiveMessage(
    args: ReceiveMessageCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<ReceiveMessageCommandOutput>;
  receiveMessage(
    args: ReceiveMessageCommandInput,
    cb: (err: any, data?: ReceiveMessageCommandOutput) => void
  ): void;
  receiveMessage(
    args: ReceiveMessageCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ReceiveMessageCommandOutput) => void
  ): void;
  removePermission(
    args: RemovePermissionCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<RemovePermissionCommandOutput>;
  removePermission(
    args: RemovePermissionCommandInput,
    cb: (err: any, data?: RemovePermissionCommandOutput) => void
  ): void;
  removePermission(
    args: RemovePermissionCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: RemovePermissionCommandOutput) => void
  ): void;
  sendMessage(
    args: SendMessageCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<SendMessageCommandOutput>;
  sendMessage(
    args: SendMessageCommandInput,
    cb: (err: any, data?: SendMessageCommandOutput) => void
  ): void;
  sendMessage(
    args: SendMessageCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: SendMessageCommandOutput) => void
  ): void;
  sendMessageBatch(
    args: SendMessageBatchCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<SendMessageBatchCommandOutput>;
  sendMessageBatch(
    args: SendMessageBatchCommandInput,
    cb: (err: any, data?: SendMessageBatchCommandOutput) => void
  ): void;
  sendMessageBatch(
    args: SendMessageBatchCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: SendMessageBatchCommandOutput) => void
  ): void;
  setQueueAttributes(
    args: SetQueueAttributesCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<SetQueueAttributesCommandOutput>;
  setQueueAttributes(
    args: SetQueueAttributesCommandInput,
    cb: (err: any, data?: SetQueueAttributesCommandOutput) => void
  ): void;
  setQueueAttributes(
    args: SetQueueAttributesCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: SetQueueAttributesCommandOutput) => void
  ): void;
  startMessageMoveTask(
    args: StartMessageMoveTaskCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<StartMessageMoveTaskCommandOutput>;
  startMessageMoveTask(
    args: StartMessageMoveTaskCommandInput,
    cb: (err: any, data?: StartMessageMoveTaskCommandOutput) => void
  ): void;
  startMessageMoveTask(
    args: StartMessageMoveTaskCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: StartMessageMoveTaskCommandOutput) => void
  ): void;
  tagQueue(
    args: TagQueueCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<TagQueueCommandOutput>;
  tagQueue(
    args: TagQueueCommandInput,
    cb: (err: any, data?: TagQueueCommandOutput) => void
  ): void;
  tagQueue(
    args: TagQueueCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: TagQueueCommandOutput) => void
  ): void;
  untagQueue(
    args: UntagQueueCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<UntagQueueCommandOutput>;
  untagQueue(
    args: UntagQueueCommandInput,
    cb: (err: any, data?: UntagQueueCommandOutput) => void
  ): void;
  untagQueue(
    args: UntagQueueCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: UntagQueueCommandOutput) => void
  ): void;
}
export declare class SQS extends SQSClient implements SQS {}
