# EDT

**Assumptions from brief (labeled):** EDT is a toolbox of deployable ops tools. First tools: **Monitor** and **Sentry + Performance**. **Simple Sentry Endpoint behavior is preserved** (`/` landing, auth redirect to dashboard, all existing routes). **EDT Hub lives at `/hub`**. One `npm run dev`, port 3000. Visual world inherits SimpleSentryEndpoint.

## Audience

Operators who already run Simple Sentry and want more tools without a new design language.

## Success

Open Hub → pick Monitor or Sentry+Performance → work in that tool without hunting ports/bookmarks.
