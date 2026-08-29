
declare module "node:child_process" {
  export function execFileSync(
    command: string,
    args: string[],
    options: { cwd: string; stdio: "pipe" },
  ): unknown;
}

declare module "node:fs" {
  export function mkdtempSync(prefix: string): string;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function writeFileSync(path: string, data: string | Uint8Array, encoding?: string): void;
  export function readFileSync(path: string): Buffer;
  export function readFileSync(path: string, encoding: string): string;
  export function readdirSync(path: string): string[];
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
}

declare const Buffer: {
  from(data: number[] | ArrayBuffer): Buffer;
  isBuffer(value: unknown): value is Buffer;
};

declare const __dirname: string;

declare const process: {
  env: Record<string, string | undefined>;
  pid: number;
};
