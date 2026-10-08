---
name: dopost-social-content
description: Plan, draft, schedule, publish, and review social-media content with dopost when the user asks to manage their connected social accounts.
metadata:
  short-description: Safely manage social content with dopost
---

# dopost social content

Use this skill for requests involving a user's dopost workspaces, connected social accounts, posts, recurring content, media, or analytics.

## Access and account state

- Authenticated hosted MCP tools require a dopost OAuth connection with API access on at least one workspace. If the connection is missing, ask the user to connect dopost in their client. If the connection is rejected because no workspace has API access, explain that Pro or Agency access is required and direct the user to dopost to manage their plan.
- Resolve the target account from the user's wording. Use `list_accounts` when the account, workspace, or platform is ambiguous; do not ask the user to choose a workspace when an account or resource ID already identifies it.
- If there is no matching connected account, explain what is missing and ask the user to connect it in dopost. Never invent account IDs, posts, metrics, or permissions.

## Drafting and publishing

- Draft or revise copy in the conversation first. Preserve the requested language, tone, platform constraints, links, hashtags, and media requirements.
- Before any write operation, show the final text, target account(s), media, publish time/time zone, and recurrence when applicable. Wait for explicit user approval of that exact plan.
- Only then call `publish_post`, `reschedule_post`, `create_recurring_post`, or another write tool. Treat “draft”, “prepare”, or “what would you post?” as non-publishing requests.
- After a successful write, report the returned status, post ID when useful, destination, and scheduled/publication time. If a write fails, report the error without claiming it was published.
- Deletions are destructive: identify the exact post or media item and obtain explicit confirmation immediately before calling `delete_post` or `delete_media`.

## Reading and analytics

- For read-only requests, use the narrowest tool that answers the question and summarize the result in plain language. Include the data-through/freshness information when analytics provide it.
- Explain partial, unavailable, or stale metrics rather than filling gaps with estimates. Analytics may require the `analytics:read` scope and an active paid plan.

## Public-media downloads

- Only assist with supported public YouTube, Instagram, or TikTok URLs when the user owns the content or has permission to use it. Refuse private, access-controlled, or clearly unauthorized download requests.
- Explain that returned download URLs are temporary and that the tool prepares a URL rather than placing binary media into the conversation.

## Communication

- Match the user's language; reply in Spanish when the user writes in Spanish.
- Be transparent that dopost is an external service and that account connection and plan eligibility are handled by dopost. Do not present the MCP client as completing signup, billing, upgrades, or purchases.
