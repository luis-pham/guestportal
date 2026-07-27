import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const evidenceDir = resolve(repoRoot, 'evidence/phase-07/07.5');
const logsDir = resolve(evidenceDir, 'logs');
const audioDir = resolve(evidenceDir, 'audio');
const reportPath = resolve(logsDir, 'real-gemini-live-report.json');
const transcriptPath = resolve(logsDir, 'real-gemini-live-transcript.log');
const outputAudioPath = resolve(audioDir, 'gemini-output-24khz.pcm');

const defaultModel = 'models/gemini-3.1-flash-live-preview';
const liveWsUrl =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

const kbFact = 'The Aurora Hotel pool is open from 06:00 to 22:00 every day.';
const toolName = 'request_draft';
const startedAt = new Date().toISOString();
const debugMessages = [];

function normalizeModel(model) {
  return model.includes('/') ? model : `models/${model}`;
}

function loadDotenv(path) {
  if (!existsSync(path)) return;
  const body = readFileSync(path, 'utf8');
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function redactError(error) {
  return error instanceof Error ? error.message.replace(process.env.GEMINI_API_KEY ?? '', '[redacted]') : String(error);
}

function writeReport(report) {
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

function blocked(reason, details = {}) {
  writeReport({
    status: 'BLOCKED',
    startedAt,
    finishedAt: new Date().toISOString(),
    reason,
    ...details,
  });
  process.exitCode = 2;
}

function fail(reason, details = {}) {
  writeReport({
    status: 'FAIL',
    startedAt,
    finishedAt: new Date().toISOString(),
    reason,
    ...details,
  });
  process.exitCode = 1;
}

function parseWavPcm(path) {
  const buffer = readFileSync(path);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Generated sample is not a WAVE file.');
  }

  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (id === 'fmt ') {
      format = {
        audioFormat: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      };
    }
    if (id === 'data') {
      data = buffer.subarray(chunkStart, chunkStart + size);
      break;
    }
    offset = chunkStart + size + (size % 2);
  }

  if (!format || !data) {
    throw new Error('Generated sample is missing fmt/data chunks.');
  }
  if (
    format.audioFormat !== 1 ||
    format.channels !== 1 ||
    format.sampleRate !== 16000 ||
    format.bitsPerSample !== 16
  ) {
    throw new Error(
      `Generated sample has unsupported format ${JSON.stringify(format)}.`,
    );
  }
  return data;
}

function generateAudioSample(text) {
  mkdirSync(audioDir, { recursive: true });
  const aiffPath = resolve(audioDir, 'pool-hours-source.aiff');
  const wavPath = resolve(audioDir, 'pool-hours-16khz.wav');
  execFileSync('say', ['-o', aiffPath, text], { stdio: 'ignore' });
  execFileSync('afconvert', [aiffPath, wavPath, '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1'], {
    stdio: 'ignore',
  });
  return { wavPath, pcm: parseWavPcm(wavPath) };
}

async function createEphemeralToken(apiKey, model) {
  const now = Date.now();
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      fieldMask: 'model,generationConfig.responseModalities,sessionResumption',
      bidiGenerateContentSetup: {
        model,
        generationConfig: {
          responseModalities: ['AUDIO'],
        },
        sessionResumption: {},
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`auth_tokens returned ${response.status}: ${JSON.stringify(body)}`);
  }
  if (!body.name || typeof body.name !== 'string') {
    throw new Error('auth_tokens response did not include token name.');
  }
  return {
    token: body.name,
    expireTime: body.expireTime,
    newSessionExpireTime: body.newSessionExpireTime,
  };
}

function openLiveSocket(token) {
  return new Promise((resolveSocket, rejectSocket) => {
    const url = new URL(liveWsUrl);
    url.searchParams.set('access_token', token);
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      rejectSocket(new Error('Timed out opening Gemini Live WebSocket.'));
    }, 15_000);
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolveSocket(socket);
    });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      rejectSocket(new Error('Gemini Live WebSocket failed to open.'));
    });
  });
}

function waitForTurn(socket, predicate, timeoutMs) {
  const messages = [];
  return new Promise((resolveTurn, rejectTurn) => {
    const timeout = setTimeout(() => {
      cleanup();
      rejectTurn(new Error(`Timed out waiting for Gemini Live turn after ${timeoutMs}ms.`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
    }

    async function onMessage(event) {
      const text = typeof event.data === 'string' ? event.data : await event.data.text();
      const payload = JSON.parse(text);
      messages.push(payload);
      debugMessages.push(payload);
      if (predicate(payload, messages)) {
        cleanup();
        resolveTurn(messages);
      }
    }

    function onError() {
      cleanup();
      rejectTurn(new Error('Gemini Live WebSocket emitted an error.'));
    }

    function onClose(event) {
      cleanup();
      rejectTurn(new Error(`Gemini Live WebSocket closed early: ${event.code} ${event.reason}`));
    }

    socket.addEventListener('message', onMessage);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
  });
}

function collectSummary(messages) {
  const inputTranscripts = [];
  const outputTranscripts = [];
  const toolCalls = [];
  let outputAudioBytes = 0;
  let sessionHandleReceived = false;
  let usageMetadataReceived = false;

  for (const message of messages) {
    const content = message.serverContent;
    if (content?.inputTranscription?.text) inputTranscripts.push(content.inputTranscription.text);
    if (content?.outputTranscription?.text) outputTranscripts.push(content.outputTranscription.text);
    if (message.sessionResumptionUpdate?.newHandle) sessionHandleReceived = true;
    if (message.usageMetadata) usageMetadataReceived = true;
    for (const part of content?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) {
        const bytes = Buffer.from(part.inlineData.data, 'base64');
        outputAudioBytes += bytes.byteLength;
        appendOutputAudio(bytes);
      }
    }
    for (const call of message.toolCall?.functionCalls ?? []) {
      toolCalls.push({
        id: call.id,
        name: call.name,
        args: call.args ?? {},
      });
    }
  }

  return {
    inputTranscript: inputTranscripts.join(' ').trim(),
    outputTranscript: outputTranscripts.join(' ').trim(),
    toolCalls,
    outputAudioBytes,
    sessionHandleReceived,
    usageMetadataReceived,
  };
}

function appendOutputAudio(bytes) {
  mkdirSync(audioDir, { recursive: true });
  const previous = existsSync(outputAudioPath) ? readFileSync(outputAudioPath) : Buffer.alloc(0);
  writeFileSync(outputAudioPath, Buffer.concat([previous, bytes]));
}

function sendSetup(socket, model) {
  socket.send(
    JSON.stringify({
      setup: {
        model,
        generationConfig: {
          responseModalities: ['AUDIO'],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: true,
          },
          activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
        },
        sessionResumption: {},
        systemInstruction: {
          parts: [
            {
              text: [
                'You are Aurora Assistant for a hotel guest portal.',
                kbFact,
                'When a guest asks about pool hours, answer with the exact hours.',
                'When a guest asks for a service request, call request_draft and do not say it is committed.',
              ].join(' '),
            },
          ],
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'knowledge_search',
                description: 'Search the property knowledge base. Read-only.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                    locale: { type: 'string' },
                    limit: { type: 'integer' },
                  },
                  required: ['query'],
                },
              },
              {
                name: toolName,
                description: 'Create a request draft only. The guest must confirm before submission.',
                parameters: {
                  type: 'object',
                  properties: {
                    requestType: { type: 'string' },
                    title: { type: 'string' },
                    details: { type: 'string' },
                    locale: { type: 'string' },
                  },
                  required: ['title'],
                },
              },
            ],
          },
        ],
      },
    }),
  );
}

function sendAudio(socket, pcm) {
  socket.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
  const chunkSize = 3200;
  for (let offset = 0; offset < pcm.length; offset += chunkSize) {
    const chunk = pcm.subarray(offset, offset + chunkSize);
    socket.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: Buffer.from(chunk).toString('base64'),
            mimeType: 'audio/pcm;rate=16000',
          },
        },
      }),
    );
  }
  socket.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
}

function sendText(socket, text) {
  socket.send(JSON.stringify({ realtimeInput: { text } }));
}

function sendToolResponses(socket, calls) {
  socket.send(
    JSON.stringify({
      toolResponse: {
        functionResponses: calls.map((call) => ({
          id: call.id,
          name: call.name,
          response: {
            result: {
              draft: {
                id: 'real-provider-draft-evidence',
                title: call.args?.title ?? 'Extra towels',
                status: 'draft',
                requiresGuestConfirmation: true,
              },
            },
          },
        })),
      },
    }),
  );
}

async function main() {
  loadDotenv(resolve(repoRoot, '.env'));
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    blocked('Gemini provider credential is not configured.');
    return;
  }

  const model = normalizeModel(process.env.GEMINI_LIVE_MODEL || defaultModel);
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(audioDir, { recursive: true });
  writeFileSync(transcriptPath, '');
  if (existsSync(outputAudioPath)) writeFileSync(outputAudioPath, '');

  let token;
  let socket;
  try {
    const audio = generateAudioSample('What time is the Aurora Hotel pool open?');
    token = await createEphemeralToken(apiKey, model);
    socket = await openLiveSocket(token.token);
    sendSetup(socket, model);
    await waitForTurn(socket, (message) => Boolean(message.setupComplete), 20_000);

    const audioStartedAt = performance.now();
    sendAudio(socket, audio.pcm);
    const audioMessages = await waitForTurn(
      socket,
      (message, messages) =>
        Boolean(message.serverContent?.turnComplete) &&
        collectSummary(messages).outputTranscript.includes('06:00'),
      45_000,
    );
    const audioLatencyMs = Math.round(performance.now() - audioStartedAt);
    const audioSummary = collectSummary(audioMessages);

    sendText(socket, 'Tiếng Việt: hồ bơi mở lúc mấy giờ? Trả lời ngắn gọn.');
    const viMessages = await waitForTurn(
      socket,
      (message, messages) =>
        Boolean(message.serverContent?.turnComplete) &&
        /06:00|6:00/.test(collectSummary(messages).outputTranscript),
      45_000,
    );
    const viSummary = collectSummary(viMessages);

    sendText(socket, 'Please create a housekeeping request draft for two extra towels.');
    const toolMessages = await waitForTurn(
      socket,
      (_message, messages) => collectSummary(messages).toolCalls.some((call) => call.name === toolName),
      45_000,
    );
    const toolSummary = collectSummary(toolMessages);
    sendToolResponses(socket, toolSummary.toolCalls.filter((call) => call.name === toolName));
    const toolResponseMessages = await waitForTurn(
      socket,
      (message) => Boolean(message.serverContent?.turnComplete),
      45_000,
    );
    const toolResponseSummary = collectSummary(toolResponseMessages);

    const report = {
      status: 'PASS',
      label: 'REAL_STAGING',
      startedAt,
      finishedAt: new Date().toISOString(),
      docsChecked: [
        'https://ai.google.dev/gemini-api/docs/live-api',
        'https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens',
        'https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket',
        'https://ai.google.dev/gemini-api/docs/live-api/capabilities',
        'https://ai.google.dev/gemini-api/docs/live-api/tools',
      ],
      model,
      credential: 'GEMINI_API_KEY=SET',
      ephemeralToken: {
        created: true,
        redacted: true,
        expireTime: token.expireTime,
        newSessionExpireTime: token.newSessionExpireTime,
      },
      websocket: {
        opened: true,
        endpoint: 'BidiGenerateContentConstrained',
      },
      audioInput: {
        generatedWith: 'say + afconvert',
        wavPath: audio.wavPath.replace(repoRoot, '.'),
        pcmBytes: audio.pcm.byteLength,
        latencyMs: audioLatencyMs,
        inputTranscript: audioSummary.inputTranscript,
        outputTranscript: audioSummary.outputTranscript,
        outputAudioBytes: audioSummary.outputAudioBytes,
        verified: audioSummary.outputTranscript.includes('06:00'),
      },
      languageSamples: [
        {
          locale: 'en',
          modality: 'audio',
          verified: audioSummary.outputTranscript.includes('06:00'),
        },
        {
          locale: 'vi',
          modality: 'text over Live realtimeInput',
          outputTranscript: viSummary.outputTranscript,
          verified: /06:00|6:00/.test(viSummary.outputTranscript),
        },
      ],
      toolDraft: {
        requestedTool: toolName,
        calls: toolSummary.toolCalls,
        responseTranscript: toolResponseSummary.outputTranscript,
        verified: toolSummary.toolCalls.some((call) => call.name === toolName),
      },
      reconnect: {
        sessionHandleReceived:
          audioSummary.sessionHandleReceived ||
          viSummary.sessionHandleReceived ||
          toolSummary.sessionHandleReceived ||
          toolResponseSummary.sessionHandleReceived,
      },
      usageMetadataReceived:
        audioSummary.usageMetadataReceived ||
        viSummary.usageMetadataReceived ||
        toolSummary.usageMetadataReceived ||
        toolResponseSummary.usageMetadataReceived,
      artifacts: {
        transcriptLog: transcriptPath.replace(repoRoot, '.'),
        outputAudioPcm: outputAudioPath.replace(repoRoot, '.'),
      },
    };

    writeFileSync(
      transcriptPath,
      [
        `audio.inputTranscript=${audioSummary.inputTranscript}`,
        `audio.outputTranscript=${audioSummary.outputTranscript}`,
        `vi.outputTranscript=${viSummary.outputTranscript}`,
        `tool.calls=${JSON.stringify(toolSummary.toolCalls)}`,
        `tool.responseTranscript=${toolResponseSummary.outputTranscript}`,
      ].join('\n') + '\n',
    );

    if (!report.audioInput.verified || !report.toolDraft.verified) {
      fail('Real Gemini Live checks ran but did not satisfy acceptance criteria.', report);
      return;
    }
    writeReport(report);
  } catch (error) {
    fail(redactError(error), {
      label: 'REAL_STAGING',
      model,
      credential: 'GEMINI_API_KEY=SET',
      tokenCreated: Boolean(token),
      debugMessages: debugMessages.slice(-12),
    });
  } finally {
    socket?.close();
  }
}

await main();
