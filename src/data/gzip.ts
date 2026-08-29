
export class GzipUnsupportedError extends Error {}

function hasCompressionStream(): boolean {
  return typeof CompressionStream !== "undefined";
}

function hasDecompressionStream(): boolean {
  return typeof DecompressionStream !== "undefined";
}

async function pipeThroughStream(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const view = new Uint8Array(bytes);
  const piped = new Blob([view]).stream().pipeThrough(stream);
  const buffer = await new Response(piped).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (!hasCompressionStream()) {
    throw new GzipUnsupportedError('CompressionStream("gzip") is unavailable in this runtime.');
  }
  return pipeThroughStream(bytes, new CompressionStream("gzip"));
}

export async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (!hasDecompressionStream()) {
    throw new GzipUnsupportedError('DecompressionStream("gzip") is unavailable in this runtime.');
  }
  return pipeThroughStream(bytes, new DecompressionStream("gzip"));
}
