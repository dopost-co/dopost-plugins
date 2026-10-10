import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DopostApi implements ICredentialType {
	name = 'dopostApi';
	displayName = 'Dopost API';
	documentationUrl = 'https://github.com/dopost-co/dopost-plugins/tree/main/n8n#credentials';
	icon = {
		light: 'file:../nodes/Dopost/dopost-logo.svg',
		dark: 'file:../nodes/Dopost/dopost-logo.svg',
	} as const;
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { 'x-api-key': '={{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: { baseURL: 'https://dopost.co', url: '/api/v1/workspaces', method: 'GET' },
	};
}
