import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../node_modules/livekit-client/', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
if (version !== '2.23.0') throw new Error(`Review the signal shutdown fix before using livekit-client ${version}.`);

const bundles = [
  {
    file: 'dist/livekit-client.esm.mjs',
    digest: 'b290395a2dc17485d9d8a8072162936efd07240482f15e0beb74fd667d7ecac5',
    edits: [
      ['this.log.error("error reading from signal stream", {',
        'if (attemptId === this.attemptId && this.lifecycleState !== "disconnecting" && this.lifecycleState !== "closed") this.log.error("error reading from signal stream", {'],
      ['  resetPingTimeout() {\n    this.clearPingTimeout();',
        '  resetPingTimeout() {\n    this.clearPingTimeout(); if (this.lifecycleState === "disconnecting" || this.lifecycleState === "closed") return;'],
      ['this.client.onMediaSectionsRequirement = requirement => {',
        'this.client.onMediaSectionsRequirement = requirement => {\n      if (this.isClosed && !this.pcManager) return;'],
    ],
  },
  {
    file: 'dist/livekit-client.umd.js',
    digest: '2ba79f4a34510b8be1a79b8e815e32648704e5873115f6b7ca8d45b8158b97d0',
    edits: [
      ['this.log.error("error reading from signal stream",{error:n})',
        't===this.attemptId&&this.lifecycleState!=="disconnecting"&&this.lifecycleState!=="closed"&&this.log.error("error reading from signal stream",{error:n})'],
      ['resetPingTimeout(){this.clearPingTimeout(),this.pingTimeoutDuration?',
        'resetPingTimeout(){this.clearPingTimeout();if(this.lifecycleState==="disconnecting"||this.lifecycleState==="closed")return;this.pingTimeoutDuration?'],
      ['this.client.onMediaSectionsRequirement=e=>{this.addMediaSections',
        'this.client.onMediaSectionsRequirement=e=>{if(this.isClosed&&!this.pcManager)return;this.addMediaSections'],
    ],
  },
];

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const updates = new Map();
for (const { file, digest, edits } of bundles) {
  const url = new URL(file, root);
  let text = await readFile(url, 'utf8');
  if (sha256(text) === digest) continue;
  for (const [before, after] of edits) {
    if (!text.includes(after)) text = text.replace(before, after);
  }
  if (sha256(text) !== digest) throw new Error(`Unexpected LiveKit bundle contents in ${file}.`);
  updates.set(url, text);
}
for (const [url, text] of updates) await writeFile(url, text);
