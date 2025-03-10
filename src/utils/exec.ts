import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

export const exec = promisify(execCallback);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export async function execWithTimeout(
  command: string,
  timeoutMs = 30000
): Promise<ExecResult> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);
  });

  const execution = exec(command);

  try {
    const result = await Promise.race([execution, timeout]);
    return result as ExecResult;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Command failed: ${command}\nError: ${error.message}`);
    }
    throw error;
  }
}

export async function execSafely(
  command: string,
  options?: {
    timeout?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<string> {
  try {
    const { stdout, stderr } = await execWithTimeout(
      command,
      options?.timeout
    );

    if (stderr) {
      console.warn(`Command produced warnings: ${stderr}`);
    }

    return stdout.trim();
  } catch (error) {
    throw new Error(
      `Failed to execute command: ${command}\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}
