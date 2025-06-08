import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import ejs from "ejs";
import { type MCPHooksConfig, writeConfig } from "./config.js";
import { DOCKERFILE_TEMPLATE } from "./templates.js";

export async function generateProject(
  config: MCPHooksConfig,
  projectDirectory: string,
): Promise<void> {
  const outputDir = join(process.cwd(), projectDirectory);

  try {
    // Step 0: Check if directory exists
    try {
      await access(outputDir);
      console.log(
        chalk.yellow(
          `⚠️  Directory ${projectDirectory} already exists. Files may be overwritten.`,
        ),
      );
    } catch {
      // Directory doesn't exist, which is good
    }

    // Create project directory
    await mkdir(outputDir, { recursive: true });

    // Step 1: Write config file
    console.log(chalk.blue("\n📝 Writing configuration..."));
    const configPath = join(outputDir, "mcphooks.config.json");
    await writeConfig(configPath, config);
    console.log(chalk.green("✓ Created mcphooks.config.json"));

    // Step 2: Generate Dockerfile
    console.log(chalk.blue("\n🐳 Generating Dockerfile..."));
    const dockerfilePath = join(outputDir, "Dockerfile");
    await generateDockerfile(dockerfilePath, config);
    console.log(chalk.green("✓ Created Dockerfile"));

    // Step 3: Create .dockerignore
    console.log(chalk.blue("\n📄 Creating .dockerignore..."));
    const dockerignorePath = join(outputDir, ".dockerignore");
    await writeFile(dockerignorePath, generateDockerignore(), "utf-8");
    console.log(chalk.green("✓ Created .dockerignore"));

    // Step 4: Create basic package.json if it doesn't exist
    const packageJsonPath = join(outputDir, "package.json");
    try {
      await readFile(packageJsonPath);
    } catch {
      console.log(chalk.blue("\n📦 Creating package.json..."));
      await writeFile(packageJsonPath, generatePackageJson(config), "utf-8");
      console.log(chalk.green("✓ Created package.json"));
    }

    // Step 5: Show summary and instructions
    showSummary(config, projectDirectory);
  } catch (error) {
    console.error(chalk.red("\n❌ Error generating project:"), error);
    throw error;
  }
}

async function generateDockerfile(
  path: string,
  config: MCPHooksConfig,
): Promise<void> {
  const dockerfile = ejs.render(DOCKERFILE_TEMPLATE, { config });
  await writeFile(path, dockerfile, "utf-8");
}

function generateDockerignore(): string {
  return `node_modules
.git
.gitignore
*.log
.DS_Store
.env
.env.*
dist
build
coverage
.vscode
.idea
*.swp
*.swo
`;
}

function generatePackageJson(config: MCPHooksConfig): string {
  const pkg = {
    name: "mcp-passthrough-proxy",
    version: "1.0.0",
    description: "MCP Passthrough Proxy with hooks",
    type: "module",
    scripts: {
      start: "node dist/cli.js start-proxy --config mcphooks.config.json",
      build: "echo 'No build required'",
    },
    dependencies: {
      "@civic/passthrough-proxy-builder": "^1.0.0",
    },
    engines: {
      node: ">=18.0.0",
    },
  };

  return JSON.stringify(pkg, null, 2);
}

function showSummary(config: MCPHooksConfig, projectDirectory: string): void {
  const boxWidth = 60;
  const line = "═".repeat(boxWidth);
  const thinLine = "─".repeat(boxWidth);
  
  console.log(chalk.cyan(`\n╔${line}╗`));
  console.log(chalk.cyan("║") + chalk.green.bold(" ✅ MCP Proxy Successfully Configured!".padEnd(boxWidth)) + chalk.cyan("║"));
  console.log(chalk.cyan(`╚${line}╝`));

  // Configuration Summary
  console.log(chalk.yellow("\n📋 Configuration Summary:"));
  console.log(thinLine);
  
  // Target Server
  console.log(chalk.white("🎯 Target Server:"));
  if (config.target.mode === "local") {
    console.log(chalk.gray(`   Mode: `) + chalk.white("Local"));
    console.log(chalk.gray(`   Command: `) + chalk.white(config.target.command));
  } else {
    console.log(chalk.gray(`   Mode: `) + chalk.white("Remote"));
    console.log(chalk.gray(`   URL: `) + chalk.white(config.target.url));
  }
  
  // Proxy Settings
  console.log(chalk.white("\n🔌 Proxy Settings:"));
  console.log(chalk.gray(`   Port: `) + chalk.white(config.proxy.port));
  console.log(chalk.gray(`   Mode: `) + chalk.white(config.proxy.mode));

  // Hooks
  console.log(chalk.white("\n🪝 Hooks (execution order):"));
  if (config.hooksOrder.length === 0) {
    console.log(chalk.gray("   No hooks configured"));
  } else {
    config.hooksOrder.forEach((hook, index) => {
      if (hook.type === "built-in") {
        console.log(chalk.gray(`   ${index + 1}. `) + chalk.white(hook.name));
      } else {
        console.log(chalk.gray(`   ${index + 1}. `) + chalk.white(hook.alias) + chalk.gray(` → ${hook.url}`));
      }
    });
  }

  // Files Generated
  console.log(chalk.yellow("\n📁 Files Generated:"));
  console.log(thinLine);
  console.log(chalk.gray(`   ./${projectDirectory}/`));
  console.log(chalk.gray(`   ├── mcphooks.config.json`) + chalk.green(" ✓"));
  console.log(chalk.gray(`   ├── Dockerfile`) + chalk.green(" ✓"));
  console.log(chalk.gray(`   ├── .dockerignore`) + chalk.green(" ✓"));
  console.log(chalk.gray(`   └── package.json`) + chalk.green(" ✓"));

  // Docker Commands
  console.log(chalk.yellow("\n🐳 Docker Commands:"));
  console.log(thinLine);
  console.log(chalk.gray("   Build the image:"));
  console.log(`   ${chalk.cyan("$")} ${chalk.white(`cd ${projectDirectory}`)}`);
  console.log(`   ${chalk.cyan("$")} ${chalk.white("docker build -t mcp-proxy .")}`);
  console.log(chalk.gray("\n   Run the container:"));
  console.log(`   ${chalk.cyan("$")} ${chalk.white(`docker run -p ${config.proxy.port}:${config.proxy.port} mcp-proxy`)}`);

  // Next Steps
  console.log(chalk.yellow("\n🚀 Next Steps:"));
  console.log(thinLine);
  console.log(chalk.white("   1. Review the generated configuration files"));
  console.log(chalk.white("   2. Build the Docker image using the command above"));
  console.log(chalk.white("   3. Run the container to start your proxy"));
  console.log(chalk.white(`   4. Configure your MCP client to connect to:`));
  console.log(chalk.green(`      http://localhost:${config.proxy.port}`));

  // Tips
  console.log(chalk.yellow("\n💡 Tips:"));
  console.log(thinLine);
  console.log(chalk.gray("   • You can modify mcphooks.config.json to change settings"));
  console.log(chalk.gray("   • Add environment variables to docker run for runtime config"));
  console.log(chalk.gray("   • Use docker logs to debug any connection issues"));
  
  console.log(chalk.cyan(`\n╔${line}╗`));
  console.log(chalk.cyan("║") + chalk.green.bold(" Happy proxying! 🎉".padEnd(boxWidth)) + chalk.cyan("║"));
  console.log(chalk.cyan(`╚${line}╝\n`));
}
