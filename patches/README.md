# SDK Patches

## @codeany/open-agent-sdk@0.2.1.patch

This patch adds capabilities the upstream SDK does not yet support:

1. **priorMessages on Agent** — Injects pre-loaded conversation history into the
   SDK Agent's internal `history` array at construction time. This enables
   stateless multi-turn context: when the Agent Pool doesn't have a cached
   instance, a new Agent is created with the full conversation history as
   bootstrap. Without this, follow-up questions lose all prior context.

2. **modifiedOutput hook** — Allows PostToolUse hooks to replace tool output
   before it re-enters the LLM conversation. Used by the tool-output-interceptor
   to cache structured data and inject summaries.

3. **thinking/reasoning_content support** — Preserves reasoning blocks from
   thinking-enabled models (DeepSeek-R1, OpenAI o-series) so they survive
   round-trips in the conversation array. Required because these models reject
   assistant messages that omit the previous reasoning_content.

4. **MiniMax XML tool-call parsing** — MiniMax M-series emits tool calls as
   inline XML (`<minimax:tool_call>`) instead of standard OpenAI `tool_calls`
   JSON. This parser extracts the XML and converts to SDK tool_use blocks.
   Also overrides `stop_reason` to `tool_use` when XML tool calls are detected,
   because MiniMax returns `stop` instead of `tool_calls`.

5. **DuckDuckGo URL extraction** — Unwraps redirect URLs from DuckDuckGo
   search results to get the real target URL.

### When to revisit

Check if upstream has added any of these features natively when:
- Upgrading `@codeany/open-agent-sdk` beyond 0.2.1
- The SDK adds a conversation history injection API
- MiniMax tool-call format changes

If any feature is available natively, remove the corresponding patch hunk
and use the built-in support.
