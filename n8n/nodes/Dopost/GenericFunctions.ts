import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

type Context = IExecuteFunctions | ILoadOptionsFunctions;

export async function dopostRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	qs: IDataObject = {},
	body?: IDataObject,
): Promise<IDataObject> {
	const authentication = this.getNodeParameter('authentication', 0) as string;
	const credential = authentication === 'oAuth2' ? 'dopostOAuth2Api' : 'dopostApi';
	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			credential,
			{
				method,
				url: `https://dopost.co/api/v1${path}`,
				qs,
				...(body === undefined ? {} : { body }),
				json: true,
				timeout: 30000,
			},
			authentication === 'oAuth2'
				? { oauth2: { keyToIncludeInAccessTokenHeader: 'x-api-key' } }
				: undefined,
		)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export function idPath(value: string): string {
	if (!value || /[\\/]|\.\./.test(value))
		throw new Error('Enter a valid ID without slashes or path segments');
	return encodeURIComponent(value);
}

export function arrayResponse(this: Context, response: IDataObject, field: string): IDataObject[] {
	const values = response[field];
	if (
		!Array.isArray(values) ||
		values.some((value) => !value || typeof value !== 'object' || Array.isArray(value))
	) {
		throw new NodeOperationError(
			this.getNode(),
			`Dopost returned an unexpected '${field}' response`,
		);
	}
	return values as IDataObject[];
}

export function jsonParameter(
	this: IExecuteFunctions,
	name: string,
	index: number,
	shape: 'array' | 'object',
): IDataObject | IDataObject[] {
	const input = this.getNodeParameter(name, index, shape === 'array' ? '[]' : '{}');
	let value: unknown;
	try {
		value = typeof input === 'string' ? JSON.parse(input) : input;
	} catch {
		throw new NodeOperationError(this.getNode(), `Enter valid JSON in '${name}'`, {
			itemIndex: index,
		});
	}
	if (
		!value ||
		(shape === 'array' ? !Array.isArray(value) : typeof value !== 'object' || Array.isArray(value))
	) {
		throw new NodeOperationError(this.getNode(), `'${name}' must be a JSON ${shape}`, {
			itemIndex: index,
		});
	}
	return value as IDataObject | IDataObject[];
}

export function futureDate(this: IExecuteFunctions, value: string, index: number): string {
	const date = new Date(value);
	if (!value || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
		throw new NodeOperationError(this.getNode(), 'Choose a future publish date', {
			itemIndex: index,
		});
	}
	return date.toISOString();
}

export async function listPosts(
	this: IExecuteFunctions,
	qs: IDataObject,
	returnAll: boolean,
	limit: number,
): Promise<IDataObject[]> {
	const posts: IDataObject[] = [];
	const cursors = new Set<string>();
	let cursor: string | undefined;
	do {
		const response = await dopostRequest.call(this, 'GET', '/post', {
			...qs,
			limit: returnAll ? 100 : Math.min(100, limit - posts.length),
			...(cursor ? { cursor } : {}),
		});
		posts.push(...arrayResponse.call(this, response, 'posts'));
		if (response.hasMore !== true || (!returnAll && posts.length >= limit)) break;
		const next = response.nextCursor;
		if (typeof next !== 'string' || !next || cursors.has(next)) {
			throw new NodeOperationError(this.getNode(), 'Dopost returned an invalid pagination cursor');
		}
		cursors.add(next);
		cursor = next;
	} while (cursor !== undefined);
	return returnAll ? posts : posts.slice(0, limit);
}

export function simplifyPost(post: IDataObject): IDataObject {
	const { id, status, platform, text, media, account, workspace, schedule, postUrl, jobId } = post;
	return {
		id,
		status,
		platform,
		text,
		media,
		account,
		workspace,
		schedule,
		...(postUrl === undefined ? {} : { postUrl }),
		jobId,
	};
}
