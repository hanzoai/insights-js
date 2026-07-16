# OpenAI + Insights AI Examples

Track OpenAI API calls with Insights.

## Setup

```bash
pnpm install
cp .env.example .env
# Fill in your API keys in .env
```

## Examples

- **chat-completions.ts** - Chat Completions API with tool calling
- **chat-completions-streaming.ts** - Chat Completions with streaming
- **responses.ts** - Responses API with tool calling
- **responses-streaming.ts** - Responses API with streaming
- **embeddings.ts** - Text embeddings
- **transcription.ts** - Audio transcription (Whisper)
- **image-generation.ts** - Image generation via Responses API

## Run

```bash
source .env
npx tsx chat-completions.ts
npx tsx responses-streaming.ts
```
