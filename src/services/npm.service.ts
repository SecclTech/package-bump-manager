import { exec } from '../utils/exec.js';
import { LOCAL_PATH } from '../config/constants.js';

export async function updatePackageVersion(
  packageName: string,
  version: string
): Promise<void> {
  const command = [
    `cd ${LOCAL_PATH}`,
    'npm install',
    `${packageName}@${version}`,
    `--cache ${LOCAL_PATH}`,
    '--package-lock-only'
  ].join(' && ');

  await exec(command);
}
