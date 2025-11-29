import { S3 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Lazily constructs an S3 client for DigitalOcean Spaces.
 * Reads environment variables at call-time to avoid build-time failures.
 * Throws an error if required variables are missing; callers should catch and respond with 500.
 */
export function getS3Client(): S3 {
  const {
    DO_ENDPOINT,
    DO_REGION,
    DO_ACCESS_KEY_ID,
    DO_ACCESS_KEY_SECRET,
  } = process.env;

  if (!DO_ENDPOINT || !DO_REGION || !DO_ACCESS_KEY_ID || !DO_ACCESS_KEY_SECRET) {
    throw new Error(
      "DigitalOcean S3 configuration missing (DO_ENDPOINT, DO_REGION, DO_ACCESS_KEY_ID, DO_ACCESS_KEY_SECRET)"
    );
  }

  return new S3({
    endpoint: DO_ENDPOINT,
    region: DO_REGION,
    credentials: {
      accessKeyId: DO_ACCESS_KEY_ID,
      secretAccessKey: DO_ACCESS_KEY_SECRET,
    },
  });
}

export { getSignedUrl };
