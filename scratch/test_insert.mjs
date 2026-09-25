import fs from 'fs';
import { insertNewLinkLine } from '../src/utils/internalLinker.js';

const html = fs.readFileSync('content/preview-acerca-de-mexboss.html', 'utf8');
const result = insertNewLinkLine(
  html,
  'Guía de Apuestas de Fútbol Liga MX en Mexboss',
  '/guia-apuestas-liga-mx/',
  'after-toc',
  'pipe'
);

const idx = result.indexOf('Guía de Apuestas');
console.log('Index:', idx);
console.log(result.substring(idx - 60, idx + 180));
