import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Элемент #root не найден');
}

createRoot(rootElement).render(<StrictMode>QuizBeat</StrictMode>);
