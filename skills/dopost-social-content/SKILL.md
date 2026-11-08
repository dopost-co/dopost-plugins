---
name: dopost-social-content
description: Plan, draft, schedule, publish, and review social-media content with dopost when the user asks to manage their connected social accounts.
metadata:
  short-description: Safely manage social content with dopost
---

# dopost social content

Use this skill for requests involving a user's dopost workspaces, connected social accounts, posts, recurring content, media, or analytics.

## Access and account state

- Authenticated hosted MCP tools require a dopost OAuth connection with API access on at least one workspace. If the connection is missing, ask the user to connect dopost in their client. If the connection is rejected because no workspace has API access, explain that Creator, Pro or Agency access is required and direct the user to dopost to manage their plan.
- Resolve the target account from the user's wording. Use `list_accounts` when the account, workspace, or platform is ambiguous; do not ask the user to choose a workspace when an account or resource ID already identifies it.
- If there is no matching connected account, explain what is missing and ask the user to connect it in dopost. Never invent account IDs, posts, metrics, or permissions.

## Drafting and publishing

- Draft or revise copy in the conversation first. Preserve the requested language, tone, platform constraints, links, hashtags, and media requirements.
- Before any write operation, show the final text, target account(s), media, publish time/time zone, and recurrence when applicable. Wait for explicit user approval of that exact plan.
- Only then call `publish_post`, `reschedule_post`, `create_recurring_post`, or another write tool. Treat “draft”, “prepare”, or “what would you post?” as non-publishing requests.
- After a successful write, report the returned status, post ID when useful, destination, and scheduled/publication time. If a write fails, report the error without claiming it was published.
- Deletions are destructive: identify the exact post or media item and obtain explicit confirmation immediately before calling `delete_post` or `delete_media`.

## Drafts, groups, and platform checks

- For a request to save a draft in dopost, use `publish_post` with `draft: true` and omit `publishAt`. For a request to propose copy, draft in the conversation without saving. Saved drafts return `status: "draft"` and a `postId`, with no publication job or monthly publishing charge; readback uses `DRAFT`. Continue editing or publish them in the dopost dashboard.
- Draft content can be incomplete or exceed platform publishing limits. Its attached files still pass upload size, format and integrity checks. Never switch to publishing just to save a draft.
- Before publishing or scheduling, call `get_platform_limits` once per distinct destination platform. Use the chosen post type's requirements to check text, media count, thread entries and each account's overrides. Only assess file properties from verified metadata; filenames and URLs do not establish dimensions, duration or codecs. Explain known violations with the affected field, actual value and limit. The server validates actual received files before creating posts.
- Use `accountId` for one account or `posts` for a group of 1–20 distinct active accounts in the same workspace. Each item requires `accountId` and inherits top-level `text`, `media`, `platformOptions`, `replyTo` and `thread`. A supplied item field replaces the entire default field; arrays and objects are not merged. Use `media: []` to clear shared media for one account.
- Put `draft`, `publishAt` and `timezone` only at the top level. Shared media URLs are imported and inspected once per request; different media URLs are prepared separately. A group validation failure rejects the whole request before creating posts and identifies `accountId`, zero-based `postIndex` and the affected field.
- A group returns `groupId` and a `postId` per account. Track each post ID; a group ID is not a post ID, and delivery outcomes are independent per network after acceptance. Publishing counts one publication per account. Deleting a member deletes the whole group and is blocked by published/processing members; make that scope explicit before deletion. Rescheduling a post changes only that member.
- If the installed tool schema lacks `draft`, `posts` or other required fields, refresh/reconnect the MCP client. Do not silently replace the requested workflow with individual posts or live publication.

## Media and validation errors

- The hosted MCP server cannot read a local file path and does not expose `upload_media`. Use an existing ready file in the destination workspace or a public HTTPS source URL. Dopost copies external attachments to its storage before accepting the post; the source must remain accessible until import completes. These copies are post-only and do not consume Media library storage.
- If the agent can upload a local file through REST, use `POST /api/v1/media`, PUT to the returned presigned URL, then `POST /api/v1/media/{id}/finalize`; wait for `READY` before attaching its `publicUrl`. The stdio MCP package's `upload_media`, when available, handles all three steps. Use `purpose: "post"` for a post attachment or `purpose: "library"` (the default) to save in Media. See [upload documentation](https://dopost.co/docs/api/endpoints/media/upload).
- Library files allow up to 1 GB, subject to available storage. Post attachments allow 500 MB on paid plans and 50 MB on Free, with smaller destination limits where applicable. Accepted uploads are JPEG, PNG, GIF, MP4 and MOV. Upload success verifies the file; platform publishing eligibility is checked when publishing/scheduling.
- An MCP error has `isError: true` and preserves API details in `structuredContent`. Explain the returned message and `errorCode`, file/account, field, stage, actual value and expected limit when present. `POST_VALIDATION_FAILED` provides blocking `issues[]` (`422`, or `413` for size violations); `warnings` do not block acceptance. Never claim a post was created after a rejected request.
- `415 MEDIA_FILE_CORRUPT` / `MEDIA_UNREADABLE` requires a newly exported readable file; `MEDIA_FORMAT_UNSUPPORTED` requires a supported format; `MEDIA_TYPE_MISMATCH` requires a matching declared MIME and file. A direct upload rejected for size, format or integrity (`413`/`415`) is marked `FAILED` and removed from storage. Newly staged external copies are cleaned up after import failure; an existing library file is not deleted just because platform validation rejects it.
- `503 MEDIA_INSPECTION_TIMEOUT` / `MEDIA_INSPECTION_UNAVAILABLE` means the inspection service failed, not that the file is invalid. A direct upload remains pending for another finalization attempt with the same media ID. For `409 MEDIA_NOT_READY` / `MEDIA_CHANGED`, check readiness and the indicated recovery action. Source/storage errors may include `reasonCode` or `upstreamStatus`; use `retryable` as returned, and explain uncertainty when it is `null`.
- Poll accepted posts by their returned IDs rather than submitting them again. If the creation response is lost, inspect recent posts before retrying to avoid duplicates. A failed status query does not establish a failed publication.

## Reading and analytics

- For read-only requests, use the narrowest tool that answers the question and summarize the result in plain language. Include the data-through/freshness information when analytics provide it.
- Explain partial, unavailable, or stale metrics rather than filling gaps with estimates. Analytics may require the `analytics:read` scope and an active paid plan.

## Public-media downloads

- Only assist with supported public YouTube, Instagram, or TikTok URLs when the user owns the content or has permission to use it. Refuse private, access-controlled, or clearly unauthorized download requests.
- Explain that returned download URLs are temporary and that the tool prepares a URL rather than placing binary media into the conversation.

## Communication

- Match the user's language; reply in Spanish when the user writes in Spanish.
- Be transparent that dopost is an external service and that account connection and plan eligibility are handled by dopost. Do not present the MCP client as completing signup, billing, upgrades, or purchases.
