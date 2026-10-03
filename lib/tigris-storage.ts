import "server-only";

import type { Readable } from "node:stream";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_LIFETIME_SECONDS = 5 * 60;
const DOWNLOAD_URL_LIFETIME_SECONDS = 5 * 60;

function getTigrisConfig() {
	const endpoint = process.env.TIGRIS_ENDPOINT;
	const bucket = process.env.TIGRIS_BUCKET_NAME;
	const accessKeyId = process.env.TIGRIS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.TIGRIS_SECRET_ACCESS_KEY;

	if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
		throw new Error("Missing Tigris storage configuration");
	}

	return { accessKeyId, bucket, endpoint, secretAccessKey };
}

let client: S3Client | null = null;

function getTigrisClient() {
	if (!client) {
		const config = getTigrisConfig();
		client = new S3Client({
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			endpoint: config.endpoint,
			forcePathStyle: true,
			region: process.env.TIGRIS_REGION ?? "auto",
		});
	}

	return client;
}

export async function createUploadUrl({ objectKey }: { objectKey: string }) {
	const { bucket } = getTigrisConfig();

	return getSignedUrl(
		getTigrisClient(),
		new PutObjectCommand({
			Bucket: bucket,
			ContentType: "application/pdf",
			Key: objectKey,
		}),
		{ expiresIn: UPLOAD_URL_LIFETIME_SECONDS },
	);
}

export async function createDownloadUrl(objectKey: string) {
	const { bucket } = getTigrisConfig();

	return getSignedUrl(
		getTigrisClient(),
		new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
		{ expiresIn: DOWNLOAD_URL_LIFETIME_SECONDS },
	);
}

/**
 * Opens a streaming body for an object so large files can be piped instead of
 * buffered in memory. The caller owns the stream and must destroy it on error.
 */
export async function createObjectBodyStream(objectKey: string) {
	const { bucket } = getTigrisConfig();
	const response = await getTigrisClient().send(
		new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
	);

	if (!response.Body) {
		throw new Error(`Tigris object ${objectKey} returned an empty body`);
	}

	return response.Body as Readable;
}

export async function inspectPdfObject(objectKey: string) {
	const { bucket } = getTigrisConfig();
	const storageClient = getTigrisClient();
	const object = await storageClient.send(
		new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
	);
	const header = await storageClient.send(
		new GetObjectCommand({
			Bucket: bucket,
			Key: objectKey,
			Range: "bytes=0-4",
		}),
	);
	const headerBytes = header.Body
		? await header.Body.transformToByteArray()
		: new Uint8Array();
	const hasPdfHeader = new TextDecoder()
		.decode(headerBytes)
		.startsWith("%PDF-");

	return {
		contentType: object.ContentType,
		hasPdfHeader,
		sizeBytes: object.ContentLength,
	};
}

export async function deleteTigrisObject(objectKey: string) {
	const { bucket } = getTigrisConfig();
	await getTigrisClient().send(
		new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
	);
}

export function getTigrisBucketName() {
	return getTigrisConfig().bucket;
}
