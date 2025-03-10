import semver from "semver";
import { PackageBuilder } from "./package_builder.js";
import { createPackageUpdatePR } from './pr-creator.js'

type Package = {
  package_name: string;
  repo_name: string;
  dependencies: Record<string, string>;
  dev_dependencies: Record<string, string>;
};

class PackageUpdater {
  private readonly owner: string;
  private packageBuilder: PackageBuilder;

  constructor(owner: string) {
    this.owner = owner;
    this.packageBuilder = new PackageBuilder();
  }

  private findParents(name: string, version: string, packages: Package[]): Package[] {
    return packages.filter((pkg) => {
      const depVersion = pkg.dependencies[name];
      const devDepVersion = pkg.dev_dependencies[name];

      return (
        (depVersion && semver.gt(version, depVersion)) ||
        (devDepVersion && semver.gt(version, devDepVersion))
      );
    });
  }

  public async bumpParents(packageName: string, newVersion: string) {
    try {
      const packages = await this.packageBuilder.getPackages();
      console.log("Packages:", packages);

      const prTargets = this.findParents(
        packageName,
        newVersion,
        packages
      );
      console.log("PR Targets:", prTargets);

      if (prTargets.length === 0) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "No parent dependencies found that need an update.",
          }),
        };
      }

      const prResults: { repo: string; prUrl?: string; error?: string }[] = [];

      for (const prTarget of prTargets) {
        const repoName = prTarget.repo_name;
        try {
          const prUrl = await createPackageUpdatePR({
            owner: this.owner,
            repo: repoName,
            packageName,
            newVersion,
          });
          console.log("PR created successfully:", prUrl);
          prResults.push({ repo: repoName, prUrl });
        } catch (error) {
          console.error(`Error creating PR for ${repoName}:`, error);
          prResults.push({ repo: repoName, error: (error as Error).message });
        }
      }
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "PR creation process completed.",
          results: prResults,
        }),
      };
    } catch (error) {
      console.error("Error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: (error as Error).message || "Unknown error occurred.",
        }),
      };
    }
  }
}
export default PackageUpdater;

