import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { Dopost } = require('../dist/nodes/Dopost/Dopost.node.js');
const { DopostApi } = require('../dist/credentials/DopostApi.credentials.js');
const { DopostOAuth2Api } = require('../dist/credentials/DopostOAuth2Api.credentials.js');
const node = new Dopost();

function fixture(parameters, responses = [], { count = 1, continueOnFail = false } = {}) {
	const requests = [];
	const context = {
		getInputData: () => Array.from({ length: count }, () => ({ json: {} })),
		getNode: () => ({
			name: 'Dopost',
			type: '@dopost/n8n-nodes-dopost.dopost',
			typeVersion: 1,
			parameters: {},
			position: [0, 0],
		}),
		continueOnFail: () => continueOnFail,
		getNodeParameter(name, index, fallback, options) {
			const item = Array.isArray(parameters) ? parameters[index] : parameters;
			const defaults = {
				authentication: 'apiKey',
				returnAll: false,
				limit: 50,
				output: 'raw',
				workspaceId: '',
				text: '',
				mediaJson: '[]',
				platformOptionsJson: '{}',
				filters: {},
				analyticsOptions: {},
				additionalFields: {},
			};
			const value = item[name] ?? defaults[name] ?? fallback;
			return options?.extractValue && value && typeof value === 'object' ? value.value : value;
		},
		helpers: {
			async httpRequestWithAuthentication(credential, request, options) {
				requests.push({ credential, request, options });
				assert.match(request.url, /^https:\/\/dopost\.co\/api\/v1\//);
				const response = responses.shift();
				if (response instanceof Error) throw response;
				assert.ok(response, 'Unexpected extra HTTP request');
				return response;
			},
		},
	};
	return { context, requests, execute: () => node.execute.call(context) };
}

test('API key is encrypted, sent as x-api-key, and tested on an authenticated endpoint', () => {
	const credential = new DopostApi();
	assert.equal(credential.properties[0].typeOptions.password, true);
	assert.equal(credential.authenticate.properties.headers['x-api-key'], '={{$credentials.apiKey}}');
	assert.equal(credential.test.request.url, '/api/v1/workspaces');
});

test('OAuth uses n8n dynamic registration and binds token exchange and refresh to the Dopost resource', async () => {
	const credential = new DopostOAuth2Api();
	assert.deepEqual(credential.extends, ['oAuth2Api']);
	const defaults = Object.fromEntries(
		credential.properties.map(({ name, default: value }) => [name, value]),
	);
	assert.equal(defaults.useDynamicClientRegistration, true);
	assert.equal(defaults.serverUrl, 'https://mcp.dopost.co/mcp');
	assert.equal(defaults.resourceUrl, defaults.serverUrl);
	const f = fixture({ resource: 'workspace', operation: 'getMany', authentication: 'oAuth2' }, [
		{ workspaces: [{ id: 'w1' }] },
	]);
	await f.execute();
	assert.equal(f.requests[0].credential, 'dopostOAuth2Api');
	assert.equal(f.requests[0].options.oauth2.keyToIncludeInAccessTokenHeader, 'x-api-key');
});

test('account filters and workspace selection are passed to the API; each account is linked to its input', async () => {
	const f = fixture(
		{
			resource: 'account',
			operation: 'getMany',
			workspaceId: { mode: 'list', value: 'w1' },
			filters: { platform: 'X', query: 'alice' },
			limit: 1,
		},
		[{ accounts: [{ id: 'a1' }, { id: 'a2' }] }],
	);
	assert.deepEqual(await f.execute(), [[{ json: { id: 'a1' }, pairedItem: { item: 0 } }]]);
	assert.deepEqual(f.requests[0].request.qs, { workspaceId: 'w1', platform: 'X', query: 'alice' });
});

test('Get Many posts follows cursors, respects limits above one page, and keeps filters', async () => {
	const f = fixture(
		{ resource: 'post', operation: 'getMany', limit: 101, filters: { status: 'PENDING' } },
		[
			{
				posts: Array.from({ length: 100 }, (_, i) => ({ id: `p${i}` })),
				hasMore: true,
				nextCursor: 'p99',
			},
			{ posts: [{ id: 'p100' }], hasMore: true, nextCursor: 'p100' },
		],
	);
	const [result] = await f.execute();
	assert.equal(result.length, 101);
	assert.deepEqual(
		f.requests.map(({ request }) => request.qs),
		[
			{ status: 'PENDING', limit: 100 },
			{ status: 'PENDING', limit: 1, cursor: 'p99' },
		],
	);
});

test('Return All stops on the final page and ignores a hidden limit', async () => {
	const f = fixture({ resource: 'post', operation: 'getMany', returnAll: true, limit: 0 }, [
		{ posts: [{ id: 'p1' }], hasMore: true, nextCursor: 'p1' },
		{ posts: [{ id: 'p2' }], hasMore: false, nextCursor: null },
	]);
	assert.equal((await f.execute())[0].length, 2);
	assert.equal(f.requests[1].request.qs.cursor, 'p1');
});

test('invalid or repeated cursors fail instead of looping forever', async () => {
	for (const nextCursor of [null, '', 'p1']) {
		const f = fixture({ resource: 'post', operation: 'getMany', returnAll: true }, [
			{ posts: [{ id: 'p1' }], hasMore: true, nextCursor: 'p1' },
			{ posts: [], hasMore: true, nextCursor },
		]);
		await assert.rejects(f.execute(), /pagination cursor/);
		assert.equal(f.requests.length, 2);
	}
});

test('Create schedules using the selected account and returns the asynchronous acceptance unchanged', async () => {
	const publishAt = new Date(Date.now() + 86400000).toISOString();
	const accepted = { postId: 'p1', jobId: 'j1', status: 'scheduled', success: true };
	const f = fixture(
		{
			resource: 'post',
			operation: 'create',
			accountId: { mode: 'id', value: 'a1' },
			text: 'Hello',
			publishingMode: 'schedule',
			publishAt,
			mediaJson: '[{"url":"https://example.com/image.jpg"}]',
			platformOptionsJson: { postType: 'feed' },
			additionalFields: { replyTo: 'remote-post', thread: '[{"text":"Follow-up"}]' },
		},
		[accepted],
	);
	assert.deepEqual((await f.execute())[0][0].json, accepted);
	assert.equal(f.requests[0].request.method, 'POST');
	assert.equal(f.requests[0].request.url, 'https://dopost.co/api/v1/post/publish');
	assert.deepEqual(f.requests[0].request.body, {
		accountId: 'a1',
		text: 'Hello',
		publishAt,
		media: [{ url: 'https://example.com/image.jpg' }],
		platformOptions: { postType: 'feed' },
		replyTo: 'remote-post',
		thread: [{ text: 'Follow-up' }],
	});
});

test('Publish Immediately omits publishAt and supports media-only posts', async () => {
	const f = fixture(
		{
			resource: 'post',
			operation: 'create',
			accountId: 'a1',
			publishingMode: 'immediate',
			publishAt: 'invalid-hidden-date',
			mediaJson: '["https://example.com/image.jpg"]',
		},
		[{ status: 'processing' }],
	);
	await f.execute();
	assert.ok(!Object.hasOwn(f.requests[0].request.body, 'publishAt'));
	assert.deepEqual(f.requests[0].request.body.media, ['https://example.com/image.jpg']);
});

test('invalid publishing input never sends a mutation', async () => {
	const base = {
		resource: 'post',
		operation: 'create',
		accountId: 'a1',
		text: 'Hello',
		publishingMode: 'immediate',
	};
	for (const changes of [
		{ text: ' ' },
		{ mediaJson: 'not-json' },
		{ mediaJson: '{}' },
		{ platformOptionsJson: '[]' },
		{ publishingMode: 'schedule', publishAt: '2000-01-01' },
		{ publishingMode: 'other' },
		{ accountId: '../a1' },
		{ mediaJson: JSON.stringify(Array(11).fill('https://example.com/a.jpg')) },
		{ additionalFields: { thread: '{}' } },
		{ additionalFields: { thread: 'not-json' } },
	]) {
		const f = fixture({ ...base, ...changes });
		await assert.rejects(f.execute());
		assert.equal(f.requests.length, 0);
	}
});

test('Get encodes IDs and simplify returns at most ten fields', async () => {
	const post = {
		id: 'p1',
		status: 'PENDING',
		text: 'Hello',
		createdAt: 'today',
		updatedAt: 'today',
		source: 'api',
		postUrl: null,
	};
	const f = fixture({ resource: 'post', operation: 'get', postId: 'p?#1', output: 'simplified' }, [
		post,
	]);
	const result = (await f.execute())[0][0].json;
	assert.equal(f.requests[0].request.url, 'https://dopost.co/api/v1/post/p%3F%231');
	assert.ok(Object.keys(result).length <= 10);
	assert.ok(!Object.hasOwn(result, 'createdAt'));
});

test('selected output always retains the post ID and only returns requested fields', async () => {
	const f = fixture(
		{
			resource: 'post',
			operation: 'get',
			postId: 'p1',
			output: 'selected',
			selectedFields: ['text'],
		},
		[{ id: 'p1', text: 'Hello', status: 'PENDING', source: 'api' }],
	);
	assert.deepEqual((await f.execute())[0][0].json, { id: 'p1', text: 'Hello' });
});

test('Reschedule uses PATCH and Delete returns the n8n deletion confirmation', async () => {
	const publishAt = new Date(Date.now() + 86400000).toISOString();
	const r = fixture({ resource: 'post', operation: 'reschedule', postId: 'p1', publishAt }, [
		{ id: 'p1', scheduledFor: publishAt },
	]);
	await r.execute();
	assert.equal(r.requests[0].request.method, 'PATCH');
	assert.deepEqual(r.requests[0].request.body, { publishAt });
	const d = fixture({ resource: 'post', operation: 'delete', postId: 'p1' }, [
		{ success: true, deletedPostId: 'p1' },
	]);
	assert.deepEqual((await d.execute())[0][0].json, { deleted: true });
	assert.equal(d.requests[0].request.method, 'DELETE');
	assert.equal(d.requests[0].request.url, 'https://dopost.co/api/v1/post/delete/p1');
});

test('each input item uses its own post parameters and output pairing', async () => {
	const f = fixture(
		[
			{ resource: 'post', operation: 'get', postId: 'p1' },
			{ resource: 'post', operation: 'get', postId: 'p2' },
		],
		[{ id: 'p1' }, { id: 'p2' }],
		{ count: 2 },
	);
	const [result] = await f.execute();
	assert.deepEqual(
		result.map((item) => item.pairedItem),
		[{ item: 0 }, { item: 1 }],
	);
	assert.ok(f.requests[1].request.url.endsWith('/post/p2'));
});

test('Continue On Fail preserves a failed item and processes the next item', async () => {
	const f = fixture(
		[
			{ resource: 'post', operation: 'get', postId: '../bad' },
			{ resource: 'post', operation: 'get', postId: 'p2' },
		],
		[{ id: 'p2' }],
		{ count: 2, continueOnFail: true },
	);
	const [result] = await f.execute();
	assert.match(result[0].json.error, /valid ID/);
	assert.equal(result[1].json.id, 'p2');
	assert.equal(f.requests.length, 1);
});

test('API failure is surfaced with its item index and is not retried by the node', async () => {
	const f = fixture(
		{
			resource: 'post',
			operation: 'create',
			text: 'Hello',
			accountId: 'a1',
			publishingMode: 'immediate',
		},
		[new Error('Rate limit exceeded')],
	);
	await assert.rejects(f.execute(), (error) => {
		assert.equal(error.context.itemIndex, 0);
		return true;
	});
	assert.equal(f.requests.length, 1);
});

test('analytics preserves the complete response and uses the selected workspace', async () => {
	const overview = {
		data: { reach: 100 },
		meta: { lastUpdatedAt: null, availability: 'unavailable' },
	};
	const f = fixture(
		{
			resource: 'analytics',
			operation: 'getOverview',
			workspaceId: 'w1',
			days: 7,
			analyticsOptions: { includeSeries: false, comparison: 'none' },
		},
		[overview],
	);
	assert.deepEqual((await f.execute())[0][0].json, overview);
	assert.deepEqual(f.requests[0].request.qs, {
		workspaceId: 'w1',
		days: 7,
		includeSeries: false,
		comparison: 'none',
	});
});

test('resource lists show names, account platforms, and workspace context', async () => {
	const w = fixture({}, [
		{
			workspaces: [
				{ id: 'w1', name: 'Team' },
				{ id: 'w2', name: 'Personal' },
			],
		},
	]);
	assert.deepEqual(await node.methods.listSearch.searchWorkspaces.call(w.context, 'team'), {
		results: [{ name: 'Team', value: 'w1' }],
	});
	const a = fixture({}, [
		{
			accounts: [
				{ id: 'a1', platform: 'X', platformUsername: 'alice', workspace: { name: 'Team' } },
			],
		},
	]);
	const result = await node.methods.listSearch.searchAccounts.call(a.context, 'alice');
	assert.equal(result.results[0].name, 'alice (X) — Team');
	assert.equal(a.requests[0].request.qs.query, 'alice');
});

test('malformed list responses fail clearly instead of returning empty success', async () => {
	const f = fixture({ resource: 'account', operation: 'getMany' }, [{ accounts: null }]);
	await assert.rejects(f.execute(), /unexpected 'accounts' response/);
});

test('Google Business events can omit text/media and keep workspace-local event dates', async () => {
	const f = fixture(
		{
			resource: 'post',
			operation: 'create',
			accountId: { mode: 'id', value: 'gb' },
			text: '',
			mediaJson: '[]',
			platformOptionsJson: JSON.stringify({
				postType: 'event',
				eventTitle: 'Open day',
				eventStart: '2027-01-23T10:00:00',
				eventEnd: '2027-01-23T12:00:00',
			}),
			publishingMode: 'immediate',
			additionalFields: { timezone: 'Europe/Madrid' },
		},
		[{ postId: 'p1', status: 'processing' }],
	);
	await f.execute();
	assert.equal(f.requests[0].request.body.platformOptions.eventStart, '2027-01-23T10:00:00');
	assert.equal(f.requests[0].request.body.timezone, 'Europe/Madrid');
});

test('Google Business monthly search terms forward account filters and pagination', async () => {
	const f = fixture(
		{
			resource: 'analytics',
			operation: 'getSearchTerms',
			workspaceId: { mode: 'id', value: 'w1' },
			days: 30,
			analyticsOptions: { accountId: 'gb', limit: 5, cursor: 'next' },
		},
		[{ searchTerms: [], nextCursor: null, hasMore: false }],
	);
	await f.execute();
	assert.equal(f.requests[0].request.url, 'https://dopost.co/api/v1/analytics/search-terms');
	assert.equal(f.requests[0].request.qs.cursor, 'next');
	assert.equal(f.requests[0].request.qs.accountId, 'gb');
});

test('Unzoned publishing dates reach the API without using the n8n host timezone', async () => {
	const f = fixture(
		{
			resource: 'post',
			operation: 'create',
			accountId: { mode: 'id', value: 'gb' },
			text: 'Update',
			publishingMode: 'schedule',
			publishAt: '2027-01-23T10:00:00',
		},
		[{ postId: 'p1', status: 'scheduled' }],
	);
	await f.execute();
	assert.equal(f.requests[0].request.body.publishAt, '2027-01-23T10:00:00');
});
