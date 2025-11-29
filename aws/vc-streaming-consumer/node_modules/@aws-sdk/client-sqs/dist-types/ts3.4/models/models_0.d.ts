import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";
import { SQSServiceException as __BaseException } from "./SQSServiceException";
export interface AddPermissionRequest {
  QueueUrl: string | undefined;
  Label: string | undefined;
  AWSAccountIds: string[] | undefined;
  Actions: string[] | undefined;
}
export declare class InvalidAddress extends __BaseException {
  readonly name: "InvalidAddress";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<InvalidAddress, __BaseException>);
}
export declare class InvalidSecurity extends __BaseException {
  readonly name: "InvalidSecurity";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<InvalidSecurity, __BaseException>);
}
export declare class OverLimit extends __BaseException {
  readonly name: "OverLimit";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<OverLimit, __BaseException>);
}
export declare class QueueDoesNotExist extends __BaseException {
  readonly name: "QueueDoesNotExist";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<QueueDoesNotExist, __BaseException>);
}
export declare class RequestThrottled extends __BaseException {
  readonly name: "RequestThrottled";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<RequestThrottled, __BaseException>);
}
export declare class UnsupportedOperation extends __BaseException {
  readonly name: "UnsupportedOperation";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<UnsupportedOperation, __BaseException>
  );
}
export interface CancelMessageMoveTaskRequest {
  TaskHandle: string | undefined;
}
export interface CancelMessageMoveTaskResult {
  ApproximateNumberOfMessagesMoved?: number | undefined;
}
export declare class ResourceNotFoundException extends __BaseException {
  readonly name: "ResourceNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ResourceNotFoundException, __BaseException>
  );
}
export interface ChangeMessageVisibilityRequest {
  QueueUrl: string | undefined;
  ReceiptHandle: string | undefined;
  VisibilityTimeout: number | undefined;
}
export declare class MessageNotInflight extends __BaseException {
  readonly name: "MessageNotInflight";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<MessageNotInflight, __BaseException>);
}
export declare class ReceiptHandleIsInvalid extends __BaseException {
  readonly name: "ReceiptHandleIsInvalid";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ReceiptHandleIsInvalid, __BaseException>
  );
}
export declare class BatchEntryIdsNotDistinct extends __BaseException {
  readonly name: "BatchEntryIdsNotDistinct";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<BatchEntryIdsNotDistinct, __BaseException>
  );
}
export interface ChangeMessageVisibilityBatchRequestEntry {
  Id: string | undefined;
  ReceiptHandle: string | undefined;
  VisibilityTimeout?: number | undefined;
}
export interface ChangeMessageVisibilityBatchRequest {
  QueueUrl: string | undefined;
  Entries: ChangeMessageVisibilityBatchRequestEntry[] | undefined;
}
export interface BatchResultErrorEntry {
  Id: string | undefined;
  SenderFault: boolean | undefined;
  Code: string | undefined;
  Message?: string | undefined;
}
export interface ChangeMessageVisibilityBatchResultEntry {
  Id: string | undefined;
}
export interface ChangeMessageVisibilityBatchResult {
  Successful: ChangeMessageVisibilityBatchResultEntry[] | undefined;
  Failed: BatchResultErrorEntry[] | undefined;
}
export declare class EmptyBatchRequest extends __BaseException {
  readonly name: "EmptyBatchRequest";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<EmptyBatchRequest, __BaseException>);
}
export declare class InvalidBatchEntryId extends __BaseException {
  readonly name: "InvalidBatchEntryId";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidBatchEntryId, __BaseException>
  );
}
export declare class TooManyEntriesInBatchRequest extends __BaseException {
  readonly name: "TooManyEntriesInBatchRequest";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<TooManyEntriesInBatchRequest, __BaseException>
  );
}
export declare const QueueAttributeName: {
  readonly All: "All";
  readonly ApproximateNumberOfMessages: "ApproximateNumberOfMessages";
  readonly ApproximateNumberOfMessagesDelayed: "ApproximateNumberOfMessagesDelayed";
  readonly ApproximateNumberOfMessagesNotVisible: "ApproximateNumberOfMessagesNotVisible";
  readonly ContentBasedDeduplication: "ContentBasedDeduplication";
  readonly CreatedTimestamp: "CreatedTimestamp";
  readonly DeduplicationScope: "DeduplicationScope";
  readonly DelaySeconds: "DelaySeconds";
  readonly FifoQueue: "FifoQueue";
  readonly FifoThroughputLimit: "FifoThroughputLimit";
  readonly KmsDataKeyReusePeriodSeconds: "KmsDataKeyReusePeriodSeconds";
  readonly KmsMasterKeyId: "KmsMasterKeyId";
  readonly LastModifiedTimestamp: "LastModifiedTimestamp";
  readonly MaximumMessageSize: "MaximumMessageSize";
  readonly MessageRetentionPeriod: "MessageRetentionPeriod";
  readonly Policy: "Policy";
  readonly QueueArn: "QueueArn";
  readonly ReceiveMessageWaitTimeSeconds: "ReceiveMessageWaitTimeSeconds";
  readonly RedriveAllowPolicy: "RedriveAllowPolicy";
  readonly RedrivePolicy: "RedrivePolicy";
  readonly SqsManagedSseEnabled: "SqsManagedSseEnabled";
  readonly VisibilityTimeout: "VisibilityTimeout";
};
export type QueueAttributeName =
  (typeof QueueAttributeName)[keyof typeof QueueAttributeName];
export interface CreateQueueRequest {
  QueueName: string | undefined;
  Attributes?: Partial<Record<QueueAttributeName, string>> | undefined;
  tags?: Record<string, string> | undefined;
}
export interface CreateQueueResult {
  QueueUrl?: string | undefined;
}
export declare class InvalidAttributeName extends __BaseException {
  readonly name: "InvalidAttributeName";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidAttributeName, __BaseException>
  );
}
export declare class InvalidAttributeValue extends __BaseException {
  readonly name: "InvalidAttributeValue";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidAttributeValue, __BaseException>
  );
}
export declare class QueueDeletedRecently extends __BaseException {
  readonly name: "QueueDeletedRecently";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<QueueDeletedRecently, __BaseException>
  );
}
export declare class QueueNameExists extends __BaseException {
  readonly name: "QueueNameExists";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<QueueNameExists, __BaseException>);
}
export interface DeleteMessageRequest {
  QueueUrl: string | undefined;
  ReceiptHandle: string | undefined;
}
export declare class InvalidIdFormat extends __BaseException {
  readonly name: "InvalidIdFormat";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<InvalidIdFormat, __BaseException>);
}
export interface DeleteMessageBatchRequestEntry {
  Id: string | undefined;
  ReceiptHandle: string | undefined;
}
export interface DeleteMessageBatchRequest {
  QueueUrl: string | undefined;
  Entries: DeleteMessageBatchRequestEntry[] | undefined;
}
export interface DeleteMessageBatchResultEntry {
  Id: string | undefined;
}
export interface DeleteMessageBatchResult {
  Successful: DeleteMessageBatchResultEntry[] | undefined;
  Failed: BatchResultErrorEntry[] | undefined;
}
export interface DeleteQueueRequest {
  QueueUrl: string | undefined;
}
export interface GetQueueAttributesRequest {
  QueueUrl: string | undefined;
  AttributeNames?: QueueAttributeName[] | undefined;
}
export interface GetQueueAttributesResult {
  Attributes?: Partial<Record<QueueAttributeName, string>> | undefined;
}
export interface GetQueueUrlRequest {
  QueueName: string | undefined;
  QueueOwnerAWSAccountId?: string | undefined;
}
export interface GetQueueUrlResult {
  QueueUrl?: string | undefined;
}
export interface ListDeadLetterSourceQueuesRequest {
  QueueUrl: string | undefined;
  NextToken?: string | undefined;
  MaxResults?: number | undefined;
}
export interface ListDeadLetterSourceQueuesResult {
  queueUrls: string[] | undefined;
  NextToken?: string | undefined;
}
export interface ListMessageMoveTasksRequest {
  SourceArn: string | undefined;
  MaxResults?: number | undefined;
}
export interface ListMessageMoveTasksResultEntry {
  TaskHandle?: string | undefined;
  Status?: string | undefined;
  SourceArn?: string | undefined;
  DestinationArn?: string | undefined;
  MaxNumberOfMessagesPerSecond?: number | undefined;
  ApproximateNumberOfMessagesMoved?: number | undefined;
  ApproximateNumberOfMessagesToMove?: number | undefined;
  FailureReason?: string | undefined;
  StartedTimestamp?: number | undefined;
}
export interface ListMessageMoveTasksResult {
  Results?: ListMessageMoveTasksResultEntry[] | undefined;
}
export interface ListQueuesRequest {
  QueueNamePrefix?: string | undefined;
  NextToken?: string | undefined;
  MaxResults?: number | undefined;
}
export interface ListQueuesResult {
  QueueUrls?: string[] | undefined;
  NextToken?: string | undefined;
}
export interface ListQueueTagsRequest {
  QueueUrl: string | undefined;
}
export interface ListQueueTagsResult {
  Tags?: Record<string, string> | undefined;
}
export declare class PurgeQueueInProgress extends __BaseException {
  readonly name: "PurgeQueueInProgress";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<PurgeQueueInProgress, __BaseException>
  );
}
export interface PurgeQueueRequest {
  QueueUrl: string | undefined;
}
export declare class KmsAccessDenied extends __BaseException {
  readonly name: "KmsAccessDenied";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<KmsAccessDenied, __BaseException>);
}
export declare class KmsDisabled extends __BaseException {
  readonly name: "KmsDisabled";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<KmsDisabled, __BaseException>);
}
export declare class KmsInvalidKeyUsage extends __BaseException {
  readonly name: "KmsInvalidKeyUsage";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<KmsInvalidKeyUsage, __BaseException>);
}
export declare class KmsInvalidState extends __BaseException {
  readonly name: "KmsInvalidState";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<KmsInvalidState, __BaseException>);
}
export declare class KmsNotFound extends __BaseException {
  readonly name: "KmsNotFound";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<KmsNotFound, __BaseException>);
}
export declare class KmsOptInRequired extends __BaseException {
  readonly name: "KmsOptInRequired";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<KmsOptInRequired, __BaseException>);
}
export declare class KmsThrottled extends __BaseException {
  readonly name: "KmsThrottled";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<KmsThrottled, __BaseException>);
}
export declare const MessageSystemAttributeName: {
  readonly AWSTraceHeader: "AWSTraceHeader";
  readonly All: "All";
  readonly ApproximateFirstReceiveTimestamp: "ApproximateFirstReceiveTimestamp";
  readonly ApproximateReceiveCount: "ApproximateReceiveCount";
  readonly DeadLetterQueueSourceArn: "DeadLetterQueueSourceArn";
  readonly MessageDeduplicationId: "MessageDeduplicationId";
  readonly MessageGroupId: "MessageGroupId";
  readonly SenderId: "SenderId";
  readonly SentTimestamp: "SentTimestamp";
  readonly SequenceNumber: "SequenceNumber";
};
export type MessageSystemAttributeName =
  (typeof MessageSystemAttributeName)[keyof typeof MessageSystemAttributeName];
export interface ReceiveMessageRequest {
  QueueUrl: string | undefined;
  AttributeNames?: QueueAttributeName[] | undefined;
  MessageSystemAttributeNames?: MessageSystemAttributeName[] | undefined;
  MessageAttributeNames?: string[] | undefined;
  MaxNumberOfMessages?: number | undefined;
  VisibilityTimeout?: number | undefined;
  WaitTimeSeconds?: number | undefined;
  ReceiveRequestAttemptId?: string | undefined;
}
export interface MessageAttributeValue {
  StringValue?: string | undefined;
  BinaryValue?: Uint8Array | undefined;
  StringListValues?: string[] | undefined;
  BinaryListValues?: Uint8Array[] | undefined;
  DataType: string | undefined;
}
export interface Message {
  MessageId?: string | undefined;
  ReceiptHandle?: string | undefined;
  MD5OfBody?: string | undefined;
  Body?: string | undefined;
  Attributes?: Partial<Record<MessageSystemAttributeName, string>> | undefined;
  MD5OfMessageAttributes?: string | undefined;
  MessageAttributes?: Record<string, MessageAttributeValue> | undefined;
}
export interface ReceiveMessageResult {
  Messages?: Message[] | undefined;
}
export interface RemovePermissionRequest {
  QueueUrl: string | undefined;
  Label: string | undefined;
}
export declare class InvalidMessageContents extends __BaseException {
  readonly name: "InvalidMessageContents";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidMessageContents, __BaseException>
  );
}
export declare const MessageSystemAttributeNameForSends: {
  readonly AWSTraceHeader: "AWSTraceHeader";
};
export type MessageSystemAttributeNameForSends =
  (typeof MessageSystemAttributeNameForSends)[keyof typeof MessageSystemAttributeNameForSends];
export interface MessageSystemAttributeValue {
  StringValue?: string | undefined;
  BinaryValue?: Uint8Array | undefined;
  StringListValues?: string[] | undefined;
  BinaryListValues?: Uint8Array[] | undefined;
  DataType: string | undefined;
}
export interface SendMessageRequest {
  QueueUrl: string | undefined;
  MessageBody: string | undefined;
  DelaySeconds?: number | undefined;
  MessageAttributes?: Record<string, MessageAttributeValue> | undefined;
  MessageSystemAttributes?:
    | Partial<
        Record<MessageSystemAttributeNameForSends, MessageSystemAttributeValue>
      >
    | undefined;
  MessageDeduplicationId?: string | undefined;
  MessageGroupId?: string | undefined;
}
export interface SendMessageResult {
  MD5OfMessageBody?: string | undefined;
  MD5OfMessageAttributes?: string | undefined;
  MD5OfMessageSystemAttributes?: string | undefined;
  MessageId?: string | undefined;
  SequenceNumber?: string | undefined;
}
export declare class BatchRequestTooLong extends __BaseException {
  readonly name: "BatchRequestTooLong";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<BatchRequestTooLong, __BaseException>
  );
}
export interface SendMessageBatchRequestEntry {
  Id: string | undefined;
  MessageBody: string | undefined;
  DelaySeconds?: number | undefined;
  MessageAttributes?: Record<string, MessageAttributeValue> | undefined;
  MessageSystemAttributes?:
    | Partial<
        Record<MessageSystemAttributeNameForSends, MessageSystemAttributeValue>
      >
    | undefined;
  MessageDeduplicationId?: string | undefined;
  MessageGroupId?: string | undefined;
}
export interface SendMessageBatchRequest {
  QueueUrl: string | undefined;
  Entries: SendMessageBatchRequestEntry[] | undefined;
}
export interface SendMessageBatchResultEntry {
  Id: string | undefined;
  MessageId: string | undefined;
  MD5OfMessageBody: string | undefined;
  MD5OfMessageAttributes?: string | undefined;
  MD5OfMessageSystemAttributes?: string | undefined;
  SequenceNumber?: string | undefined;
}
export interface SendMessageBatchResult {
  Successful: SendMessageBatchResultEntry[] | undefined;
  Failed: BatchResultErrorEntry[] | undefined;
}
export interface SetQueueAttributesRequest {
  QueueUrl: string | undefined;
  Attributes: Partial<Record<QueueAttributeName, string>> | undefined;
}
export interface StartMessageMoveTaskRequest {
  SourceArn: string | undefined;
  DestinationArn?: string | undefined;
  MaxNumberOfMessagesPerSecond?: number | undefined;
}
export interface StartMessageMoveTaskResult {
  TaskHandle?: string | undefined;
}
export interface TagQueueRequest {
  QueueUrl: string | undefined;
  Tags: Record<string, string> | undefined;
}
export interface UntagQueueRequest {
  QueueUrl: string | undefined;
  TagKeys: string[] | undefined;
}
