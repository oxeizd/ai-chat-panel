# AI Chat Configuration Documentation

## 1. General Agent Settings

- **Agent Name** – any convenient name (e.g., "GPT-4", "Analyst").
- **Base URL** – API endpoint address (e.g., `https://openrouter.ai/api/v1`).
- **Use by default** – if enabled, this agent will be selected automatically when the chat loads.
- **Common parameters (JSON)** – optional global fields added to every request body (e.g., `{"temperature": 0.7}`).
- **Common headers (JSON)** – global headers for all agent requests (e.g., `{"Authorization": "Bearer ..."}`).

## 2. Workflow (Sequence of Actions)

The **"Workflow"** field – a comma-separated list of operation names that will be executed **after each user message**.  
Example: `ask, save_log, notify`

- First the `ask` operation runs, then `save_log`, then `notify`.
- Context (variables) is passed from one step to the next.

## 3. Startup Operation

An operation that runs **once** when the agent is first used (when a session is created).  
Typically used to generate a `thread_id` or initialize a session.  
Leave empty if not needed.

## 4. Endpoint (Operation) Settings

Each operation is a separate HTTP request. You can add multiple endpoints in the interface.

### 4.1. Basic Fields

- **Operation name** – unique name (e.g., `ask`, `new_thread`).
- **HTTP method** – `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.
- **Path** – relative path, can contain variables, e.g., `/chat/{thread_id}`.
- **Headers (JSON)** – headers for this request (override global headers).
- **Body (JSON)** – request body. Supports variables like `{user_input}`, `{thread_id}`, `{messages}` etc.

### 4.2. Variables and UUID

In any text field (Path, Body, Headers) you can write `{variable_name}`.

**Standard variables:**

- `{user_input}` – the latest user message (substituted automatically).
- `{messages}` – the entire conversation history (array, if history preservation is enabled).

**UUID generation:**

- `{$uuid4}` – always generates a new random UUID (not stored in context).
- `{$uuid4:name}` – generates a UUID only once, stores it in the context as `name`. On subsequent uses, it returns the same UUID.

Example: `"thread_id": "{$uuid4:thread_id}"` – `thread_id` will be the same for all requests in the session.

### 4.3. Saving Fields from Response to Context

**"Save fields to context"** – a list of field names to extract from the response and store in the context.  
Example: `thread_id, run_id, user_id`  
After that, you can use `{thread_id}` etc. in later requests.

### 4.4. Reply Field

**"Chat reply field"** – the name of the field in the response that contains the assistant's text reply.  
If not specified, the system automatically looks for `choices[0].message.content`, `reply`, or `result`.

### 4.5. Polling (for Long-Running Tasks)

Enable **"Result polling"**. Parameters:

- **Interval (ms)** – how often to repeat the request.
- **Max attempts** – number of attempts.
- **Status field** – the field in the response that holds the status (e.g., `status`).
- **Success value** – status value indicating completion (e.g., `completed`).
- **Result field** – field from which to take the final result.
- **Retry HTTP statuses** – HTTP status codes that should trigger a retry (e.g., `202, 404`).

### 4.6. Streaming (Real-Time Output)

Enable **"Streaming (real-time output)"**. Parameters:

- **Text path** – path to the text in each chunk (e.g., `choices.0.delta.content` or `delta`).
- **Delimiter** – event separator – typically `\n\n`.
- **Data prefix** – data line prefix – typically `data: `.

If the API requires it, also add `"stream": true` in the request body.

### 4.7. Conversation History

Enable **"Conversation History"** if you want the agent to remember previous messages.  
After enabling, two additional fields appear:

- **"User message fields"** – which fields from the context should be copied into each user message.  
  Usually just `["id"]`.
- **"Assistant message fields"** – which fields from the response should be copied into each assistant message.  
  For example, `["id", "reasoning_details"]` for models that support reasoning.

**Important:** When history is enabled, you must use the `{messages}` variable in the request body (or it will be inserted automatically if the body does not contain a `messages` field). The system will accumulate the message array and pass it in the request.

### 4.8. History Synchronization via SSE (AG UI)

If the server sends a snapshot event containing all messages (e.g., `MESSAGES_SNAPSHOT`), you can specify:

- **Event type** – the event type (e.g., `"MESSAGES_SNAPSHOT"`).
- **Messages path** – the path to the messages array inside the event (e.g., `"messages"`).

When such an event is received, the local history will be replaced by the snapshot.

## 5. Example Configurations for Different APIs

### 5.1. Simple OpenRouter Chat (No History)

- **Name:** OpenRouter
- **Base URL:** `https://openrouter.ai/api/v1`
- **Endpoint:**
  - Operation: `ask`
  - Method: `POST`
  - Path: `/chat/completions`
  - Body: `{"model": "openai/gpt-3.5-turbo", "messages": [{"role": "user", "content": "{user_input}"}]}`
  - Headers: `{"Authorization": "Bearer ...", "Content-Type": "application/json"}`
- **Workflow:** `ask`
- **Startup:** empty

### 5.2. OpenRouter with History and Reasoning

- **Enable Conversation History**
- **User message fields:** `id`
- **Assistant message fields:** `id, reasoning_details`
- **Body:** `{"model": "nvidia/nemotron-3-super-120b-a12b:free", "messages": "{messages}", "stream": true, "reasoning": {"enabled": true}}`
- **Streaming:** enable, **Text path** = `choices.0.delta.content`
- **Workflow:** `ask`

### 5.3. AG UI (with MESSAGES_SNAPSHOT)

- **Enable Conversation History**
- **User message fields:** `id`
- **Assistant message fields:** `id, content`
- **History Sync:** Event type = `MESSAGES_SNAPSHOT`, Messages path = `messages`
- **Body:** `{"thread_id": "{$uuid4:thread_id}", "run_id": "{$uuid4}", "state": {}, "messages": "{messages}", "tools": [], "context": [], "forwarded_props": {}}`
- **Streaming:** enable, **Text path** = `delta`

### 5.4. Create thread_id via Startup

- **Startup operation:** `new_thread`
- **Workflow:** `ask`
- **Endpoint `new_thread`:** `GET /session/new`, **saveToContext:** `thread_id`
- **Endpoint `ask`:** `POST /session/{thread_id}/ask`, **body:** `{"message": "{user_input}"}`

## 6. Debugging

Enable **"debug"** mode in the chat settings. Then, when you click on a user message, a window will open showing the full trace: all requests, responses, SSE events, and context changes.

## 7. Common Errors and Solutions

- **Error "Unexpected token 'd'"** – The server returned SSE but streaming is not enabled for the endpoint. Enable Streaming or make sure `"stream": true` is in the request body.
- **Error 422** – Most often due to missing required fields in the request body (e.g., `id` in messages for AG UI). Add `id` to `userMessageFields` and pass `id` via the context.
- **History not preserved** – Make sure the Conversation History flag is enabled and the `{messages}` variable is used in the request body (or inserted automatically).
- **UUID not remembered** – Use the syntax `{$uuid4:name}` (must include `$`). Writing `{uuid4:name}` is just a regular variable, no generation will happen.
