import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentSession, inference, initializeLogger, voice } from '@livekit/agents';
import { dispose } from '@livekit/rtc-node';
import '../src/config.js';
import { Assistant } from '../src/assistant.js';

initializeLogger({ pretty: false, level: 'warn' });

async function createSession() {
  const model = new inference.RealtimeModel({ model: 'openai/gpt-realtime-2.1', voice: 'marin', modalities: ['text'] });
  const session = new AgentSession({ llm: model, turnHandling: { turnDetection: 'realtime_llm' } });
  await session.start({ agent: new Assistant(), record: false });
  return { session, model };
}

test('real model calls weather with the requested location and units, then uses the actual result', { timeout: 90000 }, async () => {
  const { session, model } = await createSession();
  try {
    const result = await session.run({ userInput: 'What is the weather in Prague, Czech Republic today? Please use Celsius.' }).wait();
    const call = result.expect.nextEvent({ type: 'function_call' }).isFunctionCall({ name: 'get_weather' });
    const args = JSON.parse(call.event().item.args);
    assert.match(args.location, /Prague/i);
    assert.equal(args.units, 'celsius');
    const output = result.expect.nextEvent().isFunctionCallOutput({ isError: false });
    assert.equal(JSON.parse(output.event().item.output).ok, true);
    const reply = result.expect.nextEvent().isMessage({ role: 'assistant' });
    assert.match(reply.event().item.textContent ?? '', /Open.?Meteo/i);
    result.expect.noMoreEvents();
  } finally { await session.close(); await model.close(); }
});

test('real model explains a weather provider failure instead of inventing a forecast', { timeout: 90000 }, async () => {
  using _mock = voice.testing.withMockTools(Assistant, { get_weather: () => new Error('Weather service is unavailable') });
  const { session, model } = await createSession();
  const judge = new inference.LLM({ model: 'google/gemma-4-31b-it' });
  try {
    const result = await session.run({ userInput: 'How is the weather in Tokyo, Japan right now? Celsius, please.' }).wait();
    result.expect.nextEvent({ type: 'function_call' }).isFunctionCall({ name: 'get_weather' });
    result.expect.nextEvent().isFunctionCallOutput({ isError: true });
    await result.expect.nextEvent().isMessage({ role: 'assistant' }).judge(judge, { intent: 'Clearly says the weather lookup is unavailable or failed and does not invent a temperature, forecast, or weather conditions.' });
    result.expect.noMoreEvents();
  } finally { await session.close(); await model.close(); await judge.aclose(); }
});

test('real voice model uses web search and returns official Expo source URLs', { timeout: 90000 }, async () => {
  assert.ok(process.env.OPENAI_API_KEY, 'Set a valid OPENAI_API_KEY in server/.env.local before running this optional test.');
  const { session, model } = await createSession();
  try {
    const result = await session.run({
      userInput: 'Please search the web for the current stable Expo SDK release in the official Expo release notes. Tell me the version and cite your source.',
    }).wait();
    const call = result.expect.nextEvent({ type: 'function_call' }).isFunctionCall({ name: 'search_web' });
    assert.match(JSON.parse(call.event().item.args).query, /Expo/i);
    const event = result.expect.nextEvent().isFunctionCallOutput({ isError: false });
    const output = JSON.parse(event.event().item.output);
    assert.equal(output.ok, true, 'The real search provider should succeed.');
    assert.ok(output.answer?.length > 0, 'The provider should return an answer.');
    assert.ok(output.sources?.length > 0, 'The provider should return grounded source URLs.');
    assert.ok(output.sources.some((source: { url: string }) => {
      const url = new URL(source.url);
      return url.protocol === 'https:' && (url.hostname === 'expo.dev' || url.hostname.endsWith('.expo.dev'));
    }), 'At least one source must be an official Expo page.');
    const reply = result.expect.nextEvent().isMessage({ role: 'assistant' });
    assert.match(reply.event().item.textContent ?? '', /Expo|SDK/i);
    result.expect.noMoreEvents();
    console.log(JSON.stringify({ result: 'PASS', sourceUrls: output.sources.map((source: { url: string }) => source.url) }));
  } finally {
    await session.close();
    await model.close();
  }
});

test.after(() => dispose());
