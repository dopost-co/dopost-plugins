import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeListSearchResult,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { properties } from './descriptions';
import {
	arrayResponse,
	dopostRequest,
	futureDate,
	idPath,
	jsonParameter,
	listPosts,
	simplifyPost,
} from './GenericFunctions';

export class Dopost implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'dopost',
		name: 'dopost',
		icon: { light: 'file:dopost-logo.svg', dark: 'file:dopost-logo.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage social accounts, publish and schedule posts, and read analytics',
		defaults: { name: 'dopost' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'dopostOAuth2Api',
				required: true,
				displayOptions: { show: { authentication: ['oAuth2'] } },
			},
			{
				name: 'dopostApi',
				required: true,
				displayOptions: { show: { authentication: ['apiKey'] } },
			},
		],
		properties,
	};

	methods = {
		listSearch: {
			async searchWorkspaces(
				this: ILoadOptionsFunctions,
				filter = '',
			): Promise<INodeListSearchResult> {
				const response = await dopostRequest.call(this, 'GET', '/workspaces');
				return {
					results: arrayResponse
						.call(this, response, 'workspaces')
						.filter((workspace) =>
							String(workspace.name).toLowerCase().includes(filter.toLowerCase()),
						)
						.map((workspace) => ({ name: String(workspace.name), value: String(workspace.id) })),
				};
			},
			async searchAccounts(
				this: ILoadOptionsFunctions,
				filter = '',
			): Promise<INodeListSearchResult> {
				const response = await dopostRequest.call(
					this,
					'GET',
					'/social/accounts',
					filter ? { query: filter } : {},
				);
				return {
					results: arrayResponse.call(this, response, 'accounts').map((account) => ({
						name: `${account.platformUsername || account.platformUserId} (${account.platform}) — ${(account.workspace as IDataObject).name}`,
						value: String(account.id),
					})),
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		const items = this.getInputData();
		for (let index = 0; index < items.length; index++) {
			try {
				const resource = this.getNodeParameter('resource', index) as string;
				const operation = this.getNodeParameter('operation', index) as string;
				let result: IDataObject[];
				const isList = operation === 'getMany';
				const returnAll = isList && this.getNodeParameter('returnAll', index) === true;
				const limit = isList && !returnAll ? Number(this.getNodeParameter('limit', index)) : 100;
				if (isList && (!Number.isInteger(limit) || limit < 1)) {
					throw new NodeOperationError(this.getNode(), 'Limit must be a positive integer', {
						itemIndex: index,
					});
				}
				const workspaceId =
					(isList && resource !== 'workspace') || resource === 'analytics'
						? (this.getNodeParameter('workspaceId', index, '', { extractValue: true }) as string)
						: '';
				const workspaceQuery: IDataObject = workspaceId ? { workspaceId } : {};

				if (resource === 'workspace' && operation === 'getMany') {
					result = arrayResponse.call(
						this,
						await dopostRequest.call(this, 'GET', '/workspaces'),
						'workspaces',
					);
					if (!returnAll) result = result.slice(0, limit);
				} else if (resource === 'account' && operation === 'getMany') {
					const filters = this.getNodeParameter('filters', index, {}) as IDataObject;
					result = arrayResponse.call(
						this,
						await dopostRequest.call(this, 'GET', '/social/accounts', {
							...workspaceQuery,
							...filters,
						}),
						'accounts',
					);
					if (!returnAll) result = result.slice(0, limit);
				} else if (
					resource === 'analytics' &&
					['getOverview', 'getSearchTerms'].includes(operation)
				) {
					const options = this.getNodeParameter('analyticsOptions', index, {}) as IDataObject;
					result = [
						await dopostRequest.call(
							this,
							'GET',
							operation === 'getSearchTerms' ? '/analytics/search-terms' : '/analytics/overview',
							{
								...workspaceQuery,
								days: this.getNodeParameter('days', index),
								...options,
							},
						),
					];
				} else if (resource === 'post') {
					if (operation === 'create') {
						const accountId = this.getNodeParameter('accountId', index, '', {
							extractValue: true,
						}) as string;
						idPath(accountId);
						const text = this.getNodeParameter('text', index, '') as string;
						const media = jsonParameter.call(this, 'mediaJson', index, 'array') as IDataObject[];
						const platformOptions = jsonParameter.call(
							this,
							'platformOptionsJson',
							index,
							'object',
						) as IDataObject;
						const googleEvent =
							['event', 'offer'].includes(String(platformOptions.postType)) &&
							platformOptions.eventTitle &&
							platformOptions.eventStart &&
							platformOptions.eventEnd;
						if (!googleEvent && !text.trim() && media.length === 0)
							throw new NodeOperationError(this.getNode(), 'Provide post text or media', {
								itemIndex: index,
							});
						if (media.length > 10)
							throw new NodeOperationError(
								this.getNode(),
								'A post can contain at most 10 media items',
								{ itemIndex: index },
							);
						const additional = this.getNodeParameter('additionalFields', index, {}) as IDataObject;
						const body: IDataObject = {
							accountId,
							text,
							...(media.length ? { media } : {}),
							platformOptions,
						};
						if (additional.timezone) body.timezone = additional.timezone;
						if (additional.replyTo) body.replyTo = additional.replyTo;
						if (additional.thread) {
							let thread: unknown;
							try {
								thread =
									typeof additional.thread === 'string'
										? JSON.parse(additional.thread)
										: additional.thread;
							} catch {
								throw new NodeOperationError(this.getNode(), 'Enter valid JSON in Thread', {
									itemIndex: index,
								});
							}
							if (!Array.isArray(thread))
								throw new NodeOperationError(this.getNode(), 'Thread must be a JSON array', {
									itemIndex: index,
								});
							if (thread.length > 0) body.thread = thread;
						}
						const mode = this.getNodeParameter('publishingMode', index) as string;
						if (mode === 'schedule')
							body.publishAt = futureDate.call(
								this,
								this.getNodeParameter('publishAt', index) as string,
								index,
							);
						else if (mode !== 'immediate')
							throw new NodeOperationError(this.getNode(), 'Choose a valid publishing mode', {
								itemIndex: index,
							});
						result = [await dopostRequest.call(this, 'POST', '/post/publish', {}, body)];
					} else if (operation === 'getMany') {
						result = await listPosts.call(
							this,
							{
								...workspaceQuery,
								...(this.getNodeParameter('filters', index, {}) as IDataObject),
							},
							returnAll,
							limit,
						);
					} else {
						const postId = idPath(this.getNodeParameter('postId', index) as string);
						if (operation === 'get')
							result = [await dopostRequest.call(this, 'GET', `/post/${postId}`)];
						else if (operation === 'reschedule')
							result = [
								await dopostRequest.call(
									this,
									'PATCH',
									`/post/${postId}`,
									{},
									{
										publishAt: futureDate.call(
											this,
											this.getNodeParameter('publishAt', index) as string,
											index,
										),
									},
								),
							];
						else if (operation === 'delete') {
							await dopostRequest.call(this, 'DELETE', `/post/delete/${postId}`);
							result = [{ deleted: true }];
						} else
							throw new NodeOperationError(this.getNode(), 'Choose a supported post operation', {
								itemIndex: index,
							});
					}
					if (['get', 'getMany'].includes(operation)) {
						const mode = this.getNodeParameter('output', index) as string;
						if (mode === 'simplified') result = result.map(simplifyPost);
						else if (mode === 'selected') {
							const fields = this.getNodeParameter('selectedFields', index) as string[];
							result = result.map((post) =>
								Object.fromEntries(
									['id', ...fields.filter((field) => field !== 'id')]
										.filter((field) => Object.hasOwn(post, field))
										.map((field) => [field, post[field]]),
								),
							);
						}
					}
				} else
					throw new NodeOperationError(
						this.getNode(),
						'Choose a supported resource and operation',
						{ itemIndex: index },
					);

				output.push(...result.map((json) => ({ json, pairedItem: { item: index } })));
			} catch (error) {
				if (error instanceof NodeApiError || error instanceof NodeOperationError)
					error.context.itemIndex = index;
				if (this.continueOnFail())
					output.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
				else {
					if (error instanceof NodeApiError)
						throw new NodeApiError(this.getNode(), error as unknown as JsonObject, {
							itemIndex: index,
						});
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: index });
				}
			}
		}
		return [output];
	}
}
