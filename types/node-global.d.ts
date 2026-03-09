// Provides process and require for API routes and server-side files
declare const process: {
  env: Record<string, string | undefined>
  cwd(): string
}
declare function require(module: string): any