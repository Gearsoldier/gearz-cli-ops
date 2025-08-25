import { execa } from "execa";

export const runCommand = async (cmd) => {
  console.log(`> ${cmd}`);
  const subprocess = execa(cmd, { shell: true });
  subprocess.stdout.pipe(process.stdout);
  subprocess.stderr.pipe(process.stderr);
};
