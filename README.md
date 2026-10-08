# dopost plugin

Plan, draft, schedule, publish, and analyze social media content with dopost
from Cursor and Codex. The plugin combines a social-content skill with the
hosted dopost MCP server at `https://mcp.dopost.co/mcp`.

## Package

- `.cursor-plugin/plugin.json`: Cursor manifest.
- `.codex-plugin/plugin.json`: Codex manifest.
- `mcp.cursor.json`: Cursor remote MCP configuration.
- `.mcp.json`: OpenAI marketplace MCP configuration for the Codex manifest.
- `skills/dopost-social-content/`: instructions for account selection, drafting,
  publishing approval, scheduling, and analytics.
- `assets/`: plugin logo and icon.

Cursor's manifest explicitly references `mcp.cursor.json` and `skills/`. Its
MCP URL uses the canonical endpoint without the OpenAI marketplace client
identifier. The OpenAI configurations retain their marketplace identifier.
No separate MCP server process or API key is included in the package.

## Connect your account

After loading the plugin in a compatible client, authorize the dopost MCP
connection through its OAuth flow. Sign in to dopost and review the requested
access. Account connection, social-platform authorization, and billing are
managed in dopost.

Authenticated features require an existing dopost Pro or Agency account with
API access. Publishing also requires a connected social account. Analytics
require the `analytics:read` scope, an active paid plan, and available data.
If analytics permission is missing, reauthorize the connection.

See the [dopost MCP setup guide](https://dopost.co/docs/api/mcp/setup) for
connection instructions.

## Example requests

- "Show my connected social accounts and upcoming posts."
- "Turn this changelog into LinkedIn and X posts. Show me the drafts first."
- "After I approve the wording, schedule this post tomorrow at 10:00 Europe/Madrid."
- "Compare my social performance over the last 30 days."

The skill drafts content in the conversation and asks for approval of the
content, destination, media, and timing before writing. It also requires
confirmation before deleting a post or media item.

## Capabilities and limits

The hosted server supports account and workspace discovery, post scheduling
and management, recurring posts, media-library management, platform limits,
and account, post, content, and audience analytics.

Supported public-media download tools return temporary download URLs for
content you own or have permission to use. They do not transfer binary files
through MCP.

The remote server cannot read local file paths. Local-file `upload_media` is
available in the separate stdio package, `@dopost/mcp-server`, rather than in
this hosted plugin. Metrics may be unavailable or stale depending on platform
support and collection status.

## Support

- [Documentation](https://dopost.co/docs/api/mcp/setup)
- [Support](https://dopost.co/support)
- [Privacy policy](https://dopost.co/privacy)
- [Terms of service](https://dopost.co/terms)

## License

The plugin files are distributed under the [MIT license](LICENSE). Use of the
dopost service is subject to its terms of service.
