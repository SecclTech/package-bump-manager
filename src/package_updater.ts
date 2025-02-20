import { Version } from "./version.js";
import { GithubPRCreator } from "./github_pr_creator.js";
import { PackageBuilder } from "./package_builder.js";

type Package = {
  package_name: string;
  repo_name: string;
  dependencies: Record<string, string>;
  dev_dependencies: Record<string, string>;
};

class PackageUpdater {
  private owner: string;
  private packageUpdater: GithubPRCreator;
  private packageBuilder: PackageBuilder;

  constructor(owner: string) {
    this.owner = owner;
    this.packageUpdater = new GithubPRCreator();
    this.packageBuilder = new PackageBuilder();
  }

  private findParents(name: string, version: Version, packages: Package[]): Package[] {
    return packages.filter((pkg) => {
      const depVersion = pkg.dependencies[name] ? new Version(pkg.dependencies[name]) : null;
      const devDepVersion = pkg.dev_dependencies[name] ? new Version(pkg.dev_dependencies[name]) : null;

      return (
        (depVersion && version.greaterThan(depVersion)) ||
        (devDepVersion && version.greaterThan(devDepVersion))
      );
    });
  }

  private findAllParents(
    name: string,
    packages: Package[]
  ): Record<string, Package> {
    const visited: Record<string, boolean> = {};
    const result: Record<string, Package> = {};

    const visit = (pkgName: string) => {
      if (visited[pkgName]) return;
      visited[pkgName] = true;

      for (const pkg of packages) {
        if (pkg.dependencies.hasOwnProperty(pkgName)) {
          result[pkg.package_name] = pkg;
          visit(pkg.package_name);
        }
      }
    };

    visit(name);
    return result;
  }

  public async bumpParents(packageName: string, newVersion: string) {
    try {
      const packages = await this.packageBuilder.getPackages();
      console.log("Packages:", packages);

      const prTargets = this.findParents(
        packageName,
        new Version(newVersion),
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
          const prUrl = await this.packageUpdater.createPackageUpdatePR({
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

