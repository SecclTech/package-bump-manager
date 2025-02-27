import { execSync } from "child_process";
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from "path";
import * as crypto from 'crypto';


const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const TEST_ENV = path.join(SCRIPT_DIR, "test-npm-env");
const GITHUB_USER_OR_ORG = "test-user"; // Change this if needed

interface PackageTiers {
  [key: string]: string[];
}

interface VerdaccioConfig {
  registry: string;
  username: string;
  password: string;
}

const verdaccioConfig: VerdaccioConfig = {
  registry: 'http://127.0.0.1:4873',
  username: 'testuser',
  password: 'password',
};

const packageTiers: PackageTiers = {
  tier0: ["core-library"],
  tier1: ["logger", "config-manager", "error-handler", "utils", "metrics"],
  tier2: ["auth-service", "data-processor", "cache-manager", "queue-service", "notification-service"],
  tier3: ["report-generator", "analysis-engine", "ai-model", "file-uploader", "search-indexer"],
  tier4: ["billing-service", "user-api", "inventory-api", "email-service", "fraud-detection"],
};

const createHtpasswd = (username: string, password: string): string => {
  const hash = crypto.createHash('sha1')
    .update(password)
    .digest('base64');

  return `${username}:{SHA}${hash}\n`;
};

const authenticateWithVerdaccio = async (): Promise<void> => {
  console.log("📌 Authenticating with Verdaccio...");

  try {
    execSync(
      `npx npm-cli-login -u ${verdaccioConfig.username} -p ${verdaccioConfig.password} -e test@example.com -r ${verdaccioConfig.registry}`,
      { stdio: 'inherit' }
    );
    console.log("✅ Authentication successful");
  } catch (error) {
    console.error("❌ Authentication failed:", error);
    throw error;
  }
};

const waitForVerdaccio = async (maxAttempts = 30, interval = 1000): Promise<void> => {
  console.log("📌 Waiting for Verdaccio to be ready...");

  const checkEndpoint = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch('http://127.0.0.1:4873/-/ping', {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isAvailable = await checkEndpoint();
    if (isAvailable) {
      console.log("✅ Verdaccio is ready!");
      return;
    }

    console.log(`Attempt ${attempt}/${maxAttempts}: Waiting for Verdaccio to be available...`);

    // Check if container is still running
    try {
      const isRunning = execSync('docker ps --filter "name=verdaccio" --format "{{.Status}}"', { encoding: 'utf-8' }).trim();
      if (!isRunning) {
        console.error("❌ Verdaccio container is not running!");
        console.log("📌 Container logs:");
        execSync('docker logs verdaccio', { stdio: 'inherit' });
        throw new Error("Verdaccio container stopped unexpectedly");
      }
    } catch (dockerError) {
      console.error("Error checking Docker container status:", dockerError);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Verdaccio failed to become ready after ${maxAttempts} attempts`);
};

// 🔹 Start Verdaccio
const startVerdaccio = async (): Promise<void> => {
  console.log("📌 Starting Verdaccio...");

  const configPath = path.join(SCRIPT_DIR, "verdaccio-config.yaml");
  const storagePath = path.join(SCRIPT_DIR, "storage");
  const htpasswdPath = path.join(SCRIPT_DIR, "htpasswd");

  // Reset Verdaccio storage
  console.log("📌 Removing old Verdaccio storage...");
  await fs.rm(storagePath, { recursive: true, force: true });
  await fs.mkdir(storagePath, { recursive: true });

  console.log("📌 Creating .htpasswd file...");
  const htpasswdContent = createHtpasswd('testuser', 'password');
  await fs.writeFile(htpasswdPath, htpasswdContent, 'utf8');

  // Stop any existing container
  execSync("docker rm -f verdaccio || true", { stdio: "ignore" });

  // Run Docker with logs
  const containerId = execSync(
    `docker run -d --name verdaccio \
    -p 4873:4873 \
    -v "${configPath}:/verdaccio/conf/config.yaml" \
    -v "${storagePath}:/verdaccio/storage" \
    verdaccio/verdaccio`,
    { encoding: 'utf-8' }
  ).trim();

  console.log(`Container ID: ${containerId}`);

  // Wait for Verdaccio to be ready
  await waitForVerdaccio();
};

// 🔹 Setup test environment
const setupTestEnvironment = async (): Promise<void> => {
  console.log("📌 Setting up test environment...");
  if (existsSync(TEST_ENV)) await fs.rm(TEST_ENV, { recursive: true });
  await fs.mkdir(TEST_ENV);
  process.chdir(TEST_ENV);
};

// 🔹 Create mock package JSON files
const createPackageJson = (packageName: string, dependencies: string[] = []): string => {
  const packageJson = {
    name: packageName,
    version: "1.0.0",
    author: "Seccl Test",
    publishConfig: { registry: verdaccioConfig.registry },
    dependencies: dependencies.reduce((deps, dep) => {
      deps[dep] = "1.0.0";
      return deps;
    }, {} as Record<string, string>)
  };
  return JSON.stringify(packageJson, null, 2);
};

// 🔹 Create all packages
const getTierDependencies = (tier: string, packages: PackageTiers): string[] => {
  switch (tier) {
    case 'tier1':
      return ['core-library']
    case 'tier2':
      return getRandomDependencies(packages.tier1, 2)
    case 'tier3':
      return getRandomDependencies(packages.tier2, 2)
    case 'tier4':
      return [
        ...getRandomDependencies(packages.tier3, 2),
        getRandomDependencies(packages.tier2, 1)[0]
      ]
    default:
      return []
  }
}

const createPackageFiles = async (dir: string, packageName: string, dependencies: string[], tier: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'package.json'),
    createPackageJson(packageName, dependencies)
  )
  await fs.writeFile(
    path.join(dir, '.npmrc'),
    `@seccl:registry=${verdaccioConfig.registry}\n`
  )
  await fs.writeFile(
    path.join(dir, 'index.js'),
    `module.exports = '${packageName}'\n`
  )

  await fs.writeFile(path.join(dir, "README.md"),
    "# " + packageName + "\n\n" +
    "This is a mock package for testing purposes.\n\n" +
    "## Installation\n\n" +
    "```\n" +
    "npm install " + packageName + "\n" +
    "```\n\n" +
    "## Usage\n\n" +
    "```\n" +
    "const " + packageName + " = require('" + packageName + "')\n" +
    "console.log(" + packageName + ".hello())\n" +
    "```\n\n"
  )

  if (tier === 'tier4') {
    await fs.writeFile(path.join(dir, "serverless.ts"), "")
  }
  console.log(`📦 Created package: @seccl/${packageName}`)
}

const createPackages = async (): Promise<void> => {
  await Promise.all(
    Object.entries(packageTiers).map(async ([tier, packageNames]) => {
      await Promise.all(
        packageNames.map(async (packageName) => {
          const scopedPackageName = `@seccl/${packageName}`;
          const dir = path.join(TEST_ENV, packageName);
          const dependencies = getTierDependencies(tier, packageTiers)
            .map(dep => `@seccl/${dep}`);
          await createPackageFiles(dir, scopedPackageName, dependencies, tier);
        })
      );
    })
  );
};

// 🔹 Helper function to get random dependencies
const getRandomDependencies = (sourceArray: string[], count: number): string[] => {
  return Array.from({ length: count }, () => sourceArray[Math.floor(Math.random() * sourceArray.length)]);
};

// 🔹 Install & publish packages in parallel
const installAndPublishPackages = async (): Promise<void> => {
  await authenticateWithVerdaccio();

  // Get all tiers in order
  const tiers = Object.values(packageTiers);

  // Process each tier sequentially
  for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
    const currentTier = tiers[tierIndex];
    console.log(`\n📑 Processing Tier ${tierIndex + 1}...`);

    // Process each package in the tier sequentially
    for (const packageName of currentTier) {
      const dir = path.join(TEST_ENV, packageName);
      process.chdir(dir);
      // await authenticateWithRegistry(dir, verdaccioConfig);

      console.log(`\n📦 Installing dependencies for @seccl/${packageName}...`);
      execSync("npm install --registry " + verdaccioConfig.registry, { stdio: "inherit" });

      console.log(`🚀 Publishing @seccl/${packageName} to Verdaccio...`);
      try {
        execSync("npm publish --registry " + verdaccioConfig.registry, { stdio: "inherit" });
        console.log(`✅ Successfully published @seccl/${packageName}`);
      } catch (error) {
        console.warn(`⚠️ Skipping already published package: @seccl/${packageName}`);
      }
    }

    console.log(`\n✅ Completed Tier ${tierIndex + 1}`);

    // Add a small delay between tiers to ensure npm registry has updated
    if (tierIndex < tiers.length - 1) {
      console.log('Waiting for registry to update...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

//
// // 🔹 Initialize Git repositories
// const initializeGitRepos = async (): Promise<void> => {
//   console.log("📌 Initializing Git repositories...");
//   Object.values(packageTiers).flat().forEach((packageName) => {
//     const dir = path.join(TEST_ENV, packageName);
//     process.chdir(dir);
//
//     execSync("git init", { stdio: "ignore" });
//     execSync("git branch -M main", { stdio: "ignore" });
//
//     await fs.writeFile(".gitignore", "node_modules/\n");
//     execSync("git add .");
//     execSync(`git commit -m "Initial commit for @seccl/${packageName}"`, { stdio: "ignore" });
//
//     console.log(`✅ Initialized Git repository for @seccl/${packageName}`);
//   });
// };

// 🔹 Main execution flow
const main = async (): Promise<void> => {
  try {
    await startVerdaccio();
    await setupTestEnvironment();
    await createPackages();
    await installAndPublishPackages();
    // initializeGitRepos();

    console.log("✅ All packages published and Git repos initialized successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    // process.exit(1);
  } finally {
    console.log("📌 Stopping Verdaccio...");
    // execSync("docker rm -f verdaccio", { stdio: "ignore" });

    console.log("📌 Resetting npm registry setting...");
    await fs.unlink(".npmrc");

    console.log("✅ npm is back to default registry");
  }
};

(async () => main())();
