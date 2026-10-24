import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import { createNotebook } from '../src/shared/notebook';

const notebook = createNotebook();
(window as unknown as { addHostNote: () => void }).addHostNote = () => {
  notebook.create({ title: 'A plan saved from the conversation', body: 'Synthetic host-side change for the refresh test.', kind: 'draft' });
};
const iframe = document.getElementById('plugin') as HTMLIFrameElement;
const calls: string[] = [];
(window as unknown as { toolCalls: string[] }).toolCalls = calls;
const messages: unknown[] = [];
(window as unknown as { hostMessages: unknown[] }).hostMessages = messages;
const messageMode = new URLSearchParams(window.location.search).get('messages');
const bridge = new AppBridge(null, { name: 'Starter test host', version: '1.0.0' }, {
  serverTools: {}, ...(messageMode === 'extended' ? { experimental: { 'openai/message': {} } }
    : messageMode === 'unsupported' ? {} : { message: { text: {} } }),
}, { hostContext: { theme: 'light', displayMode: 'fullscreen' } });
const result = (snapshot: ReturnType<typeof notebook.snapshot>) => ({ content: [{ type: 'text' as const, text: 'Synthetic test data.' }], structuredContent: snapshot });
bridge.oncalltool = async ({ name, arguments: args }) => {
  calls.push(name);
  if (name === 'notebook_create') return result(notebook.create(args));
  if (name === 'notebook_update') return result(notebook.update(args));
  if (name === 'notebook_favorite') return result(notebook.favorite(args));
  if (name === 'notebook_open') return result(notebook.snapshot());
  throw new Error('Unknown sample tool.');
};
bridge.onmessage = async params => {
  messages.push(params);
  return messageMode === 'reject' ? { isError: true } : {};
};
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: {} });
  await bridge.sendToolResult(result(notebook.snapshot()));
};
await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
iframe.src = '/dist/ui/index.html';
