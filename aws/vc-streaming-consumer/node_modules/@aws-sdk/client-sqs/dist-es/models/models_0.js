import { SQSServiceException as __BaseException } from "./SQSServiceException";
export class InvalidAddress extends __BaseException {
    name = "InvalidAddress";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidAddress",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidAddress.prototype);
    }
}
export class InvalidSecurity extends __BaseException {
    name = "InvalidSecurity";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidSecurity",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidSecurity.prototype);
    }
}
export class OverLimit extends __BaseException {
    name = "OverLimit";
    $fault = "client";
    constructor(opts) {
        super({
            name: "OverLimit",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, OverLimit.prototype);
    }
}
export class QueueDoesNotExist extends __BaseException {
    name = "QueueDoesNotExist";
    $fault = "client";
    constructor(opts) {
        super({
            name: "QueueDoesNotExist",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, QueueDoesNotExist.prototype);
    }
}
export class RequestThrottled extends __BaseException {
    name = "RequestThrottled";
    $fault = "client";
    constructor(opts) {
        super({
            name: "RequestThrottled",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, RequestThrottled.prototype);
    }
}
export class UnsupportedOperation extends __BaseException {
    name = "UnsupportedOperation";
    $fault = "client";
    constructor(opts) {
        super({
            name: "UnsupportedOperation",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, UnsupportedOperation.prototype);
    }
}
export class ResourceNotFoundException extends __BaseException {
    name = "ResourceNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ResourceNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
    }
}
export class MessageNotInflight extends __BaseException {
    name = "MessageNotInflight";
    $fault = "client";
    constructor(opts) {
        super({
            name: "MessageNotInflight",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, MessageNotInflight.prototype);
    }
}
export class ReceiptHandleIsInvalid extends __BaseException {
    name = "ReceiptHandleIsInvalid";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ReceiptHandleIsInvalid",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ReceiptHandleIsInvalid.prototype);
    }
}
export class BatchEntryIdsNotDistinct extends __BaseException {
    name = "BatchEntryIdsNotDistinct";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BatchEntryIdsNotDistinct",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BatchEntryIdsNotDistinct.prototype);
    }
}
export class EmptyBatchRequest extends __BaseException {
    name = "EmptyBatchRequest";
    $fault = "client";
    constructor(opts) {
        super({
            name: "EmptyBatchRequest",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, EmptyBatchRequest.prototype);
    }
}
export class InvalidBatchEntryId extends __BaseException {
    name = "InvalidBatchEntryId";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidBatchEntryId",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidBatchEntryId.prototype);
    }
}
export class TooManyEntriesInBatchRequest extends __BaseException {
    name = "TooManyEntriesInBatchRequest";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TooManyEntriesInBatchRequest",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TooManyEntriesInBatchRequest.prototype);
    }
}
export const QueueAttributeName = {
    All: "All",
    ApproximateNumberOfMessages: "ApproximateNumberOfMessages",
    ApproximateNumberOfMessagesDelayed: "ApproximateNumberOfMessagesDelayed",
    ApproximateNumberOfMessagesNotVisible: "ApproximateNumberOfMessagesNotVisible",
    ContentBasedDeduplication: "ContentBasedDeduplication",
    CreatedTimestamp: "CreatedTimestamp",
    DeduplicationScope: "DeduplicationScope",
    DelaySeconds: "DelaySeconds",
    FifoQueue: "FifoQueue",
    FifoThroughputLimit: "FifoThroughputLimit",
    KmsDataKeyReusePeriodSeconds: "KmsDataKeyReusePeriodSeconds",
    KmsMasterKeyId: "KmsMasterKeyId",
    LastModifiedTimestamp: "LastModifiedTimestamp",
    MaximumMessageSize: "MaximumMessageSize",
    MessageRetentionPeriod: "MessageRetentionPeriod",
    Policy: "Policy",
    QueueArn: "QueueArn",
    ReceiveMessageWaitTimeSeconds: "ReceiveMessageWaitTimeSeconds",
    RedriveAllowPolicy: "RedriveAllowPolicy",
    RedrivePolicy: "RedrivePolicy",
    SqsManagedSseEnabled: "SqsManagedSseEnabled",
    VisibilityTimeout: "VisibilityTimeout",
};
export class InvalidAttributeName extends __BaseException {
    name = "InvalidAttributeName";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidAttributeName",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidAttributeName.prototype);
    }
}
export class InvalidAttributeValue extends __BaseException {
    name = "InvalidAttributeValue";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidAttributeValue",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidAttributeValue.prototype);
    }
}
export class QueueDeletedRecently extends __BaseException {
    name = "QueueDeletedRecently";
    $fault = "client";
    constructor(opts) {
        super({
            name: "QueueDeletedRecently",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, QueueDeletedRecently.prototype);
    }
}
export class QueueNameExists extends __BaseException {
    name = "QueueNameExists";
    $fault = "client";
    constructor(opts) {
        super({
            name: "QueueNameExists",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, QueueNameExists.prototype);
    }
}
export class InvalidIdFormat extends __BaseException {
    name = "InvalidIdFormat";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidIdFormat",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidIdFormat.prototype);
    }
}
export class PurgeQueueInProgress extends __BaseException {
    name = "PurgeQueueInProgress";
    $fault = "client";
    constructor(opts) {
        super({
            name: "PurgeQueueInProgress",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, PurgeQueueInProgress.prototype);
    }
}
export class KmsAccessDenied extends __BaseException {
    name = "KmsAccessDenied";
    $fault = "client";
    constructor(opts) {
        super({
            name: "KmsAccessDenied",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, KmsAccessDenied.prototype);
    }
}
export class KmsDisabled extends __BaseException {
    name = "KmsDisabled";
    $fault = "client";
    constructor(opts) {
        super({
            name: "KmsDisabled",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, KmsDisabled.prototype);
    }
}
export class KmsInvalidKeyUsage extends __BaseException {
    name = "KmsInvalidKeyUsage";
    $fault = "client";
    constructor(opts) {
        super({
            name: "KmsInvalidKeyUsage",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, KmsInvalidKeyUsage.prototype);
    }
}
export class KmsInvalidState extends __BaseException {
    name = "KmsInvalidState";
    $fault = "client";
    constructor(opts) {
        super({
            name: "KmsInvalidState",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, KmsInvalidState.prototype);
    }
}
export class KmsNotFound extends __BaseException {
    name = "KmsNotFound";
    $fault = "client";
    constructor(opts) {
        super({
            name: "KmsNotFound",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, KmsNotFound.prototype);
    }
}
export class KmsOptInRequired extends __BaseException {
    name = "KmsOptInRequired";
    $fault = "client";
    constructor(opts) {
        super({
            name: "KmsOptInRequired",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, KmsOptInRequired.prototype);
    }
}
export class KmsThrottled extends __BaseException {
    name = "KmsThrottled";
    $fault = "client";
    constructor(opts) {
        super({
            name: "KmsThrottled",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, KmsThrottled.prototype);
    }
}
export const MessageSystemAttributeName = {
    AWSTraceHeader: "AWSTraceHeader",
    All: "All",
    ApproximateFirstReceiveTimestamp: "ApproximateFirstReceiveTimestamp",
    ApproximateReceiveCount: "ApproximateReceiveCount",
    DeadLetterQueueSourceArn: "DeadLetterQueueSourceArn",
    MessageDeduplicationId: "MessageDeduplicationId",
    MessageGroupId: "MessageGroupId",
    SenderId: "SenderId",
    SentTimestamp: "SentTimestamp",
    SequenceNumber: "SequenceNumber",
};
export class InvalidMessageContents extends __BaseException {
    name = "InvalidMessageContents";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidMessageContents",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidMessageContents.prototype);
    }
}
export const MessageSystemAttributeNameForSends = {
    AWSTraceHeader: "AWSTraceHeader",
};
export class BatchRequestTooLong extends __BaseException {
    name = "BatchRequestTooLong";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BatchRequestTooLong",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BatchRequestTooLong.prototype);
    }
}
