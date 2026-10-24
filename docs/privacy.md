# Sample data and permissions

Notebook starts with three synthetic notes. It stores changes only in the current MCP process. The browser preview has a separate in-memory session. Neither reads user files, scans repositories, sends network requests, stores credentials, or creates schedules.

Clicking **Work on this with Codex** sends the selected note's ID, title, body, and kind to the host conversation. It does not send other notes or silently edit any note. The browser preview shows a prompt instead. Copying that prompt writes it to the system clipboard only when you click **Copy prompt**.

In Codex, tool arguments and results pass through the host and can enter the conversation or model context. This is not a claim of local AI inference. Avoid entering sensitive data into the sample.

`notebook_open` reads state. `notebook_create`, `notebook_update`, and `notebook_favorite` change sample state. Their MCP annotations describe those effects. Tool annotations inform the host; they do not replace server-side authorization in a real integration.

When adapting the template, update this document to describe the actual storage, external services, authentication, write actions, retention, and deletion behavior. Keep secrets out of source, manifests, tool results, logs, screenshots, and release archives.
