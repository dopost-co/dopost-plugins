import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class DopostOAuth2Api implements ICredentialType {
	name = 'dopostOAuth2Api';
	extends = ['oAuth2Api'];
	displayName = 'Dopost OAuth2 API';
	documentationUrl = 'https://github.com/dopost-co/dopost-plugins/tree/main/n8n#credentials';
	icon = {
		light: 'file:../nodes/Dopost/dopost-logo.svg',
		dark: 'file:../nodes/Dopost/dopost-logo.svg',
	} as const;
	// n8n discovers Dopost's public-client registration and S256 PKCE support.
	// resourceUrl binds both the initial exchange and refresh to the MCP audience.
	properties: INodeProperties[] = [
		{
			displayName: 'Use Dynamic Client Registration',
			name: 'useDynamicClientRegistration',
			type: 'hidden',
			default: true,
		},
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'hidden',
			default: 'https://mcp.dopost.co/mcp',
		},
		{
			displayName: 'Resource URL',
			name: 'resourceUrl',
			type: 'hidden',
			default: 'https://mcp.dopost.co/mcp',
		},
	];
}
