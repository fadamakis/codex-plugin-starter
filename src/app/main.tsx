// Establish CSS layer order before any SDK component imports its own styles.
import './styles.css';
import { createRoot } from 'react-dom/client';
import { AppsSDKUIProvider } from '@openai/apps-sdk-ui/components/AppsSDKUIProvider';
import { hostBridge, previewBridge } from './bridge';
import { Notebook } from './Notebook';

const bridge = import.meta.env.DEV && window.parent === window ? previewBridge() : hostBridge();

createRoot(document.getElementById('root')!).render(
  <AppsSDKUIProvider linkComponent="a"><Notebook bridge={bridge} /></AppsSDKUIProvider>,
);

if (import.meta.hot) import.meta.hot.dispose(() => bridge.close());
