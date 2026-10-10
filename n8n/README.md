# Dopost for n8n

Manage your social accounts, schedule and publish posts, and read analytics
from your n8n workflows. This community node connects to the Dopost API.

See the [n8n integration guide](https://dopost.co/docs/api/n8n) for connection
steps and a publishing workflow, or read it in
[Spanish](https://dopost.co/es/docs/api/n8n).

Requires n8n **2.42.4 or newer** and a Dopost Pro or Agency account with API
access. A connected social account is required for publishing. Build and
development tooling use Node.js 24 or newer.

## Installation

After the package has been published, install `@dopost/n8n-nodes-dopost` through
**Settings → Community Nodes → Install** on self-hosted n8n. Availability in
the n8n Cloud node panel requires separate verification by n8n; this package
does not claim verified status.

See [installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

### OAuth2 (recommended)

Select **Dopost OAuth2 API**, then connect your account. n8n discovers the
Dopost authorization server, registers its own public client, uses S256 PKCE,
and stores and refreshes tokens. Sign in to Dopost and review the permissions
on the consent screen. You do not need to create a client secret.

Use an HTTPS n8n callback URL, or HTTP on localhost for local development.
OAuth requires n8n 2.42.4 or newer, including its dynamic registration and
resource-aware token refresh support. The existing Dopost OAuth resource is
`https://mcp.dopost.co/mcp`; authenticated operations use the Dopost REST API.

### API key

Create a key in Dopost's API settings and paste it into **Dopost API**. Enable
`social:accounts` for discovery and credential testing, plus the scopes for
the operations you need:

| Operation | Scope |
| --- | --- |
| List accounts or workspaces | `social:accounts` |
| Create, publish, or schedule a post | `posts:create` |
| Get or list posts | `posts:read` |
| Reschedule a post | `posts:reschedule` |
| Delete a post | `posts:delete` |
| Get analytics overview | `analytics:read` |

API keys are scoped to their workspace. OAuth access follows the workspaces
and permissions granted in Dopost. n8n encrypts credentials; never put keys
or access tokens into workflow parameters.

## Operations

- **Account → Get Many:** list active social accounts, optionally filtered by
  workspace, platform, or username search.
- **Workspace → Get Many:** list accessible workspaces.
- **Post → Create:** publish immediately or schedule a future post, with text,
  public media URLs, platform options, optional replies, and threads.
- **Post → Get / Get Many:** check publishing status or list posts, with
  cursor pagination and an optional status filter.
- **Post → Reschedule:** change the publication date of a pending post.
- **Post → Delete:** delete a draft or pending post and cancel its schedule.
  This does not remove an already published post from a social network.
- **Analytics → Get Overview:** retrieve the API's aggregate metrics,
  comparisons, availability metadata, and optional daily time series. Select
  a workspace if your credential can access more than one.

Accounts and workspaces can be selected from a searchable list or entered
by ID. List operations return one n8n item per result and preserve input item
links. Analytics returns one complete overview object.
For post queries, choose simplified output, the complete response, or selected
fields (always including the post ID). The node can also be used as an AI tool.

## Example workflow

1. Add a **Manual Trigger** and a **dopost** node.
2. Select **Account → Get Many** and connect your Dopost credential.
3. Run it and choose the intended account in another dopost node using
   **Post → Create**.
4. Set **Publishing Mode** to **Schedule**, choose a future date, and enter
   the text. Running this step creates a real scheduled post.
5. Use the returned `postId` with **Post → Get** to check the result.

Media accepts URLs or objects, for example:

```json
[{"url":"https://example.com/image.jpg","type":"image/jpeg","alt":"An image description"}]
```

Thread accepts additional posts, for example:

```json
[{"text":"Second post in the thread"}]
```

Threads are supported by X, Threads, and Mastodon; replies by X and Threads.
Platform-specific fields and media limits still apply. See the
[Dopost API documentation](https://dopost.co/docs/api).

## Limitations and errors

Creation returns an accepted job, not confirmation that a social network has
published the post. Poll **Post → Get** with `postId`, not `jobId`, for the
final status. Re-running Create can create another post: it is not idempotent.

Local files, binary uploads, recurring series, and trigger nodes are not
included in this version. Media URLs must be reachable by Dopost. Analytics
availability and history depend on the plan and social platform.

The API rate limit is 60 requests per minute per credential. Large paginated
queries may reach that limit. For 429 errors, wait before retrying. For 401,
reconnect OAuth or replace the key; for 403, check permissions and API plan
access. Automatic workflow retries on publishing operations can create duplicates.

## Development

```bash
cd n8n
npm ci
npm run lint
npm test
npm run dev
```

The package was scaffolded with the official `@n8n/node-cli` tool. It uses
programmatic execution to normalize per-item publishing payloads, paginate
post cursors, and send OAuth tokens in Dopost's `x-api-key` header through
n8n's authenticated HTTP helper, including after token refresh.

With the pinned CLI version, `npm run dev` starts n8n through `npx` and watches
the node source. The first run needs network access to install n8n; keep the
terminal open and use the editor URL printed when startup finishes. Use
`npm run dev -- --external-n8n` to watch builds without starting n8n; an existing
instance must be configured separately to load those builds.
Offline tests do not make requests to Dopost or publish posts.

## Releases

The public repository's `n8n-publish.yml` publishes this package from version
tags such as `n8n-v0.1.0`, using GitHub Actions and npm provenance. The npm
package must be owned by the Dopost maintainer and configured for Trusted
Publishing with `dopost-co/dopost-plugins` and `n8n-publish.yml`.
For a new npm package, use a short-lived granular `NPM_TOKEN` Actions secret
for the first release if Trusted Publishing cannot be configured yet, then
configure Trusted Publishing and remove and revoke that token.

Source sync and npm publication are separate: copying files into the public
repository does not publish an npm release. Submit the published package
through the [n8n Creator Portal](https://creators.n8n.io/nodes) for verification.

## License

[MIT](LICENSE). Use of the Dopost service is subject to its
[terms](https://dopost.co/terms) and [privacy policy](https://dopost.co/privacy).
