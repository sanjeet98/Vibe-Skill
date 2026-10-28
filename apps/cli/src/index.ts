import { Command } from "commander";
import { addCommand, initCommand, listCommand } from "./commands/index.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("vibe-skill")
    .description(
      "Vibe Skill: Open-source full-stack agent skills registry and AST scaffolding CLI",
    )
    .version("0.1.0");

  // init command
  program
    .command("init")
    .description(
      "Initialize Vibe Skill in the current repository and detect project setup",
    )
    .argument("[dir]", "Target directory", ".")
    .action(async (dir) => {
      await initCommand({ cwd: dir });
    });

  // add command
  program
    .command("add")
    .description("Install and inject a Vibe Skill into the current project")
    .argument(
      "<skill-path-or-id>",
      "Path to skill directory or skill identifier",
    )
    .option(
      "--cwd <dir>",
      "Target project directory (defaults to current working directory)",
    )
    .option("-y, --yes", "Automatic yes to prompts")
    .option("--dry-run", "Simulate mutations without modifying files on disk")
    .option("--no-install", "Skip automatic npm/pnpm package installation")
    .option("-f, --force", "Bypass framework compatibility validation")
    .action(async (skillPathOrId, opts) => {
      await addCommand(skillPathOrId, {
        cwd: opts.cwd,
        dryRun: opts.dryRun,
        yes: opts.yes,
        noInstall: !opts.install,
        force: opts.force,
      });
    });

  // list command
  program
    .command("list")
    .description("List all Vibe Skill skills installed in this project")
    .action(() => {
      listCommand();
    });

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

// Auto-run if executed directly as entrypoint
if (
  process.argv[1] &&
  (process.argv[1].endsWith("vibe-skill") ||
    process.argv[1].endsWith("antigravity") ||
    process.argv[1].endsWith("index.js") ||
    process.argv[1].endsWith("index.ts"))
) {
  runCli().catch((err) => {
    console.error("Fatal CLI Error:", err);
    process.exit(1);
  });
}
