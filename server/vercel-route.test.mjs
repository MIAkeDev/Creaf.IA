import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import handler from '../api/index.js';
import { createConversationState } from '../shared/conversation-state.mjs';

test('la función Vercel enruta el chat anónimo con body ya interpretado', async () => {
  const request = Readable.from([]);
  request.method = 'POST'; request.url = '/api/index?route=chat'; request.query = { route: 'chat' };
  request.body = { message: 'hola', conversationState: createConversationState(), conversationStarted: false };
  request.headers = { host: 'creafia.example', origin: 'https://creafia.example', 'content-type': 'application/json' };
  const response = new EventEmitter();
  response.headers = {};
  response.setHeader = (name, value) => { response.headers[name] = value; };
  response.writeHead = (status, headers) => { response.status = status; Object.assign(response.headers, headers); };
  response.end = body => { response.writableEnded = true; response.body = JSON.parse(body); };
  await handler(request, response);
  assert.equal(response.status, 200);
  assert.match(response.body.reply, /Hola/);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});
