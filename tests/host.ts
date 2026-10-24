import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import { createNotebook } from '../src/shared/notebook';

const notebook = createNotebook();
const iframe = document.getElementById('plugin') as HTMLIFrameElement;
const calls: string[] = [];
(window as unknown as { toolCalls: string[] }).toolCalls = calls;
const bridge = new AppBridge(null, { name: 'Starter test host', version: '1.0.0' }, { serverTools: {} }, { hostContext: { theme: 'light', displayMode: 'fullscreen' } });
const result = (snapshot: ReturnType<typeof notebook.snapshot>) => ({ content: [{ type: 'text' as const, text: 'Synthetic test data.' }], structuredContent: snapshot });
bridge.oncalltool = async ({ name, arguments: args }) => {
  calls.push(name);
  if (name === 'notebook_create') return result(notebook.create(args));
  if (name === 'notebook_update') return result(notebook.update(args));
  if (name === 'notebook_favorite') return result(notebook.favorite(args));
  if (name === 'notebook_open') return result(notebook.snapshot());
  throw new Error('Unknown sample tool.');
};
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: {} });
  await bridge.sendToolResult(result(notebook.snapshot()));
};
await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
iframe.src = '/dist/ui/index.html';
